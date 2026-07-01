// Pre Code 代码复制功能======
let copyText = null;
export default async () => {
  const preList = document.querySelectorAll("section.vh-code-box>pre.astro-code");
  if (!preList.length) return;
  // Pre 滚动条======
  await import("overlayscrollbars/overlayscrollbars.css");
  const { OverlayScrollbars } = await import("overlayscrollbars");
  // Pre 滚动条======
  preList.forEach((i: any) => {
    OverlayScrollbars(i, { scrollbars: { autoHide: "leave", autoHideDelay: 500, autoHideSuspend: false } });
  });
  // Pre Code 代码复制功能======
  document.querySelectorAll("section.vh-code-box>span.vh-code-copy").forEach((i: any) => {
    i.vhTimer = null;
    i.addEventListener("click", async () => {
      if (i.vhTimer) clearTimeout(i.vhTimer);
      copyText = i.parentElement.querySelector("pre.astro-code code")?.innerText;
      if (!copyText) return;
      await navigator.clipboard.writeText(copyText);
      i.classList.add("success");
      i.vhTimer = setTimeout(() => {
        i.classList.remove("success");
        i.vhTimer = null;
      }, 1000);
    });
  });
}
