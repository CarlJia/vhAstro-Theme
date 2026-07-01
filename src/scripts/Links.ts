import vh from 'vh-plugin'
import { $GET, escapeHTML, safeUrl } from '@/utils/index'
// 图片懒加载
import vhLzImgInit from "@/scripts/vhLazyImg";
// 渲染
const LinksInit = async (data: any) => {
  const linksDOM = document.querySelector('.main-inner-content>.vh-tools-main>main.links-main')
  if (!linksDOM) return;
  try {
    let res = data;
    if (typeof data === 'string') {
      res = await $GET(data);
    }
    linksDOM.innerHTML = res.map((i: any) => `<a href="${safeUrl(i.link)}" target="_blank" rel="noopener nofollow"><img class="avatar" src="${safeUrl(i.avatar, '/assets/images/local.svg')}" alt="${escapeHTML(i.name)}" /><section class="link-info"><span>${escapeHTML(i.name)}</span><p class="vh-ellipsis line-2">${escapeHTML(i.descr)}</p></section></a>`).join('');
    // 图片懒加载
    vhLzImgInit();
  } catch {
    vh.Toast('获取数据失败')
  }
}

// 友情链接初始化
import LINKS_DATA from "@/page_data/Link";
const { api, data } = LINKS_DATA;
export default () => LinksInit(api || data)
