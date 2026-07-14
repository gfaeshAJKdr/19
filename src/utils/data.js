export async function loadJson(path) {
  const response = await fetch(path, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`数据读取失败：${path}`);
  }

  return response.json();
}
