// --- 这个函数专门负责检查 48 小时是否过期 ---
function checkUnlockStatus() {
  const isUnlocked = localStorage.getItem('isUnlocked') === 'true';
  const expiryTime = localStorage.getItem('expiryTime');
  
  if (isUnlocked && expiryTime) {
    // 逻辑：如果当前时间 (Date.now()) 已经大于设定的过期时间，说明过期了
    if (Date.now() > parseInt(expiryTime)) {
      // 过期了：把这两个存储记录全部删掉，还原现场
      localStorage.removeItem('isUnlocked');
      localStorage.removeItem('expiryTime');
      return false; // 返回“过期了，需要重新输入”
    }
    return true; // 还没过期，依然是“已解锁”状态
  }
  return false; // 根本没解过锁，或者状态不存在
}

// 因为 main.js 在根目录，进 src 找文件夹
import { loadState, saveState, clearState } from "./src/services/storage.js";
import { loadJson } from "./src/utils/data.js";
import { calculateScores, pickPrimaryAndSecondary } from "./src/utils/score.js";

const app = document.querySelector("#app");

const model = {
  config: null,
  dimensions: [],
  questions: [],
  personalities: [],
  currentIndex: 0,
  answers: {},
  status: "home",
  toast: ""
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function persist() {
  saveState({
    currentIndex: model.currentIndex,
    answers: model.answers,
    status: model.status
  });
}

function showToast(message) {
  model.toast = message;
  render();
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    model.toast = "";
    render();
  }, 1800);
}

function goHome() {
  model.status = "home";
  model.currentIndex = 0;
  persist();
  render();
}

function startTest({ reset = false } = {}) {
  if (reset) {
    model.currentIndex = 0;
    model.answers = {};
  }
  model.status = "test";
  persist();
  render();
}

function completeTest() {
  const unanswered = model.questions.find((question) => !model.answers[String(question.id)]);

  if (unanswered) {
    model.currentIndex = model.questions.findIndex((question) => question.id === unanswered.id);
    model.status = "test";
    persist();
    showToast("请选择一个选项。");
    return;
  }

  model.status = "summary";
  persist();
  render();
}

function selectOption(questionId, optionKey) {
  model.answers = {
    ...model.answers,
    [String(questionId)]: optionKey
  };

  if (model.currentIndex === model.questions.length - 1) {
    completeTest();
    return;
  }

  model.currentIndex += 1;
  persist();
  render();
}

function goPrevious() {
  if (model.currentIndex === 0) {
    goHome();
    return;
  }

  model.currentIndex -= 1;
  persist();
  render();
}

function findPersonality(primary, secondary) {
  return model.personalities.find(
    (personality) => personality.primaryDimension === primary && personality.secondaryDimension === secondary
  );
}

function polarPoint(cx, cy, radius, index, total) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total;
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius
  };
}

function pointsToString(points) {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
}

function renderSpiderChart(scores) {
  const size = 320;
  const center = size / 2;
  const maxRadius = 86;
  const levels = [0.25, 0.5, 0.75, 1];
  const maxScore = Math.max(...Object.values(scores), 1);
  const total = model.dimensions.length;
  const grid = levels
    .map((level) => {
      const points = model.dimensions.map((_, index) => polarPoint(center, center, maxRadius * level, index, total));
      return `<polygon class="spider-grid" points="${pointsToString(points)}"></polygon>`;
    })
    .join("");
  const axes = model.dimensions
    .map((_, index) => {
      const point = polarPoint(center, center, maxRadius, index, total);
      return `<line class="spider-axis" x1="${center}" y1="${center}" x2="${point.x.toFixed(2)}" y2="${point.y.toFixed(2)}"></line>`;
    })
    .join("");
  const labels = model.dimensions
    .map((dimension, index) => {
      const point = polarPoint(center, center, maxRadius + 24, index, total);
      const anchor = point.x > center + 8 ? "start" : point.x < center - 8 ? "end" : "middle";
      const baseline = point.y > center + 8 ? "hanging" : point.y < center - 8 ? "auto" : "middle";
      return `<text class="spider-label" x="${point.x.toFixed(2)}" y="${point.y.toFixed(2)}" text-anchor="${anchor}" dominant-baseline="${baseline}">${escapeHtml(dimension)}</text>`;
    })
    .join("");
  const dataPoints = model.dimensions.map((dimension, index) => {
    const ratio = (scores[dimension] || 0) / maxScore;
    const radius = Math.max(8, maxRadius * ratio);
    return polarPoint(center, center, radius, index, total);
  });

  return `
    <div class="spider-wrap" aria-label="十维人格倾向蜘蛛图">
      <svg class="spider-chart" viewBox="0 0 ${size} ${size}" role="img" aria-label="十维人格倾向强弱图">
        ${grid}
        ${axes}
        <polygon class="spider-area" points="${pointsToString(dataPoints)}"></polygon>
        <polyline class="spider-line" points="${pointsToString([...dataPoints, dataPoints[0]])}"></polyline>
        ${labels}
      </svg>
    </div>
  `;
}

function renderHome() {
  const hasProgress = Object.keys(model.answers).length > 0 && model.status !== "summary";

  return `
    <main class="view home">
      <section>
        <p class="eyebrow">Mobile First</p>
        <h1 class="title">${escapeHtml(model.config.title)}</h1>
        <p class="subtitle">${escapeHtml(model.config.subtitle)}</p>
      </section>
      <section class="card home-card">
        <p class="disclaimer">${escapeHtml(model.config.disclaimer)}</p>
      </section>
      <div>
        <button class="button" data-action="start">${hasProgress ? "继续测试" : "开始测试"}</button>
        ${hasProgress ? `<button class="button secondary" data-action="restart" style="margin-top: 10px;">重新开始</button>` : ""}
      </div>
    </main>
  `;
}

function renderTest() {
  const question = model.questions[model.currentIndex];
  const selected = model.answers[String(question.id)];
  const total = model.questions.length;
  const current = model.currentIndex + 1;
  const progress = Math.round((current / total) * 100);
  const options = question.options
    .map((option) => {
      const selectedClass = selected === option.key ? " selected" : "";
      return `
        <button class="option${selectedClass}" data-action="select" data-question-id="${question.id}" data-option-key="${option.key}">
          <span class="option-key">${option.key}</span>${escapeHtml(option.text)}
        </button>
      `;
    })
    .join("");

  return `
    <main class="view">
      <header class="test-header">
        <span class="progress-text">${current} / ${total}</span>
        <span class="progress-track"><span class="progress-bar" style="width: ${progress}%"></span></span>
      </header>
      <section class="card question-card">
        <p class="question-label">情境</p>
        <h2 class="question-text">${escapeHtml(question.scenario)}</h2>
        <div class="options">${options}</div>
      </section>
      <nav class="bottom-bar single" aria-label="题目导航">
        <button class="button secondary" data-action="previous">← 上一题</button>
      </nav>
    </main>
  `;
}

function renderSummary() {
  const scores = calculateScores({
    questions: model.questions,
    answers: model.answers,
    dimensions: model.dimensions
  });

  const result = pickPrimaryAndSecondary(scores, model.dimensions);
  const personality = findPersonality(result.primary, result.secondary);

  // --- 检查解锁 ---
  const unlockedValid = window.checkUnlockStatus();
  const maskClass = unlockedValid ? "" : "blur-mask";

  const title = personality?.title || "人格画像";
  const rarity = personality?.rarity || "未知";
  const quote = personality?.quote || "——";
  const analysis = personality?.description || "暂无详细分析。";
  const trigger = personality?.darkTrigger || "暂无相关场景。";
  const reminder = personality?.kindReminder || "暂无额外提醒。";

  // --- 支付提示框的 HTML ---
  const unlockUI = !unlockedValid ? `
    <div style="margin: 20px 0; padding: 20px; border: 1px solid var(--accent); border-radius: var(--radius); text-align: center;">
      <p style="margin-bottom: 15px;">精品解析 结果丰富 24h自动发货</p>
      
      <button class="button" onclick="window.location.href='https://m.tb.cn/h.80olCSY?tk=lZF8grDanC1'">
        闲鱼App：支付宝付款
      </button>

      <div id="wxArea" style="margin-top: 15px;">
        <button class="button secondary" onclick="showWxLink()">
          微信小程序：点击获取购买链接
        </button>
      </div>

      <div style="margin-top: 20px;">
        <input type="text" id="passInput" placeholder="请输入密钥" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--line); background: var(--surface);">
        <button class="button" style="margin-top:10px" onclick="checkPassword()">验证并解锁</button>
      </div>
    </div>
  ` : "";

  return `
    <main class="view summary">
      <section class="result-hero">
        <div class="${maskClass}">
          <p>${escapeHtml(result.primary)} × ${escapeHtml(result.secondary)}</p>
          <p>人格稀有度：${escapeHtml(rarity)}</p>
        </div>
        <h1>${escapeHtml(title)}</h1>
        <p style="margin-top: 10px; font-style: italic;">“${escapeHtml(quote)}”</p>
      </section>

      <section class="card">
        <div class="${maskClass}">
          ${renderSpiderChart(scores)}
        </div>
      </section>

      <h3>📝 核心分析</h3>
      <section class="card ${maskClass}">
        <p>${escapeHtml(analysis)}</p>
      </section>

      <h3>🌑 暗黑场景激发</h3>
      <section class="card ${maskClass}">
        <p>${escapeHtml(trigger)}</p>
      </section>

      <h3>💡 善意提醒</h3>
      <section class="card ${maskClass}">
        <p>${escapeHtml(reminder)}</p>
      </section>

      ${unlockUI}

      <button class="button primary" data-action="restart" style="margin-top: 20px;">重新测试</button>
      <button class="button secondary" data-action="home" style="margin-top: 10px;">返回首页</button>
    </main>
  `;
}

function renderError(message) {
  return `
    <main class="view app-shell">
      <section class="card" style="text-align: center; margin-top: 50px;">
        <h2 style="color: #ff4d4f;">⚠️ 访问受限</h2>
        <p style="margin-top: 15px;">${escapeHtml(message)}</p>
      </section>
    </main>
  `;
}

function render() {
  let content = "";

  if (model.status === "test") {
    content = renderTest();
  } else if (model.status === "summary") {
    content = renderSummary();
  } else {
    content = renderHome();
  }

  app.innerHTML = `<div class="app-shell">${content}</div>${model.toast ? `<div class="toast">${escapeHtml(model.toast)}</div>` : ""}`;
}

function bindEvents() {
  app.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");

    if (!target) return;

    const action = target.dataset.action;

    if (action === "start") {
      startTest();
    }
    if (action === "restart") {
      clearState();
      startTest({ reset: true });
    }
    if (action === "home" || action === "reset-home") {
      clearState(); 
      goHome();
    }
    if (action === "select") {
      selectOption(target.dataset.questionId, target.dataset.optionKey);
    }
    if (action === "previous") {
      goPrevious();
    }
  });
}

async function bootstrap() {

  bindEvents();

  try {
  // 因为 main.js 和 data 都在根目录，直接找 ./data/
  const [config, dimensions, questions, personalities] = await Promise.all([
    loadJson("./data/config.json"),
    loadJson("./data/dimensions.json"),
    loadJson("./data/questions.json"),
    loadJson("./data/personalities.json")
  ]);
  

    model.config = config;
    model.dimensions = dimensions;
    model.questions = questions;
    model.personalities = personalities;

    const saved = loadState();

    if (saved) {
      model.currentIndex = Math.min(Math.max(Number(saved.currentIndex) || 0, 0), questions.length - 1);
      model.answers = saved.answers && typeof saved.answers === "object" ? saved.answers : {};

      if (saved.status === "test") {
        model.status = "test";
      } else if (saved.status === "summary") {
        model.status = "summary";
      } else {
        model.status = "home";
      }
    } else {
      model.status = "home";
    }

    render();
  } catch (error) {
    app.innerHTML = renderError(error.message || "数据读取失败，请稍后重试。");
  }
}

bootstrap();

// --- 在 main.js 最后面追加以下代码 ---

window.checkPassword = function() {
  const input = document.getElementById('passInput').value.trim();
  const validPassword = '8Kx9Vz2';

  if (input === validPassword) {
    localStorage.setItem('isUnlocked', 'true');
    
    // 【新增这行】计算48小时后的过期时间（单位是毫秒）
    const expiryTime = Date.now() + (48 * 60 * 60 * 1000);
    localStorage.setItem('expiryTime', expiryTime);
    
    location.reload(); 
  } else {
    alert("密钥验证失败，请核对后重新输入。");
  }
};

window.showWxLink = function() {
  const wxArea = document.getElementById('wxArea');
  const link = "#小程序://闲鱼/qQ8e5llwOi0zrSr";
  
  wxArea.innerHTML = `
    <div style="background: var(--surface); padding: 10px; border-radius: var(--radius); border: 1px dashed var(--accent);">
      <p style="font-size: 13px; margin-bottom: 5px;">请长按下方链接复制，在微信粘贴发送给好友即可打开：</p>
      <input type="text" value="${link}" readonly style="width: 100%; text-align: center; border: none; background: transparent; color: var(--accent); font-weight: bold;">
    </div>
  `;
};

// --- 检查 48 小时是否过期 ---
window.checkUnlockStatus = function() {
  const isUnlocked = localStorage.getItem('isUnlocked') === 'true';
  const expiryTime = localStorage.getItem('expiryTime');
  
  if (isUnlocked && expiryTime) {
    if (Date.now() > parseInt(expiryTime)) {
      localStorage.removeItem('isUnlocked');
      localStorage.removeItem('expiryTime');
      return false;
    }
    return true;
  }
  return false;
};
