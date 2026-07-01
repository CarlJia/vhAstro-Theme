import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
dayjs.extend(utc);
dayjs.extend(timezone);
// 设置中文语言环境
import 'dayjs/locale/zh-cn'
dayjs.locale('zh-cn');
// 获取文章的描述
const getDescription = (post: any, num: number = 150) => (post.rendered ? post.rendered.html.replace(/<[^>]+>/g, "").replace(/\s+/g, "") : post.body.replace(/\n/g, "").replace(/#/g, "")).slice(0, num) || '暂无简介'
//处理时间
const fmtTime = (time: any, fmt: string = 'MMMM D, YYYY') => dayjs(time).utc().format(fmt)
// 处理日期
const fmtDate = (time: string | Date, hours_status = true) => {
  const now = dayjs();
  const past = dayjs(time);
  // 计算各时间单位，逐步扣除已计算的部分
  const years = now.diff(past, 'year');
  const adjustedPastYears = past.add(years, 'year');
  const months = now.diff(adjustedPastYears, 'month');
  const adjustedPastMonths = adjustedPastYears.add(months, 'month');
  const days = now.diff(adjustedPastMonths, 'day');
  const adjustedPastDays = adjustedPastMonths.add(days, 'day');
  const hours = now.diff(adjustedPastDays, 'hour');
  const adjustedPastHours = adjustedPastDays.add(hours, 'hour');
  const minutes = now.diff(adjustedPastHours, 'minute');
  const adjustedPastMinutes = adjustedPastHours.add(minutes, 'minute');
  const seconds = now.diff(adjustedPastMinutes, 'second');
  // 构建时间差描述，仅在没有更大单位时显示较小单位
  return [
    years && `${years}年`,
    months && `${months}月`,
    days && `${days}天`,
    (hours_status || days === 0) ? hours && !years && !months && `${hours}小时` : 0,
    hours_status ? minutes && !years && !months && !days && `${minutes}分` : '',
    hours_status ? seconds && !years && !months && !days && !hours && `${seconds}秒` : ''
  ].filter(Boolean).join('');
};

// 处理页码展示
const fmtPage = (page: string | undefined) => page ? page.replace(/\//g, '') : null
// 转义 HTML 文本，避免接口数据直接拼接进 innerHTML
const htmlEscapeMap: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};
const escapeHTML = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => htmlEscapeMap[char] || char);
// 清理 URL 属性，避免 javascript: 等危险协议
const safeUrl = (value: unknown, fallback: string = '#') => {
  const url = String(value ?? '').trim();
  if (!url) return fallback;
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(url)) return escapeHTML(url);
  return fallback;
}
// 保留基础富文本展示，同时移除常见危险节点和事件属性
const sanitizeHTML = (value: unknown) => String(value ?? '')
  .replace(/<\s*(script|style|iframe|object|embed)[\s\S]*?<\/\s*\1\s*>/gi, '')
  .replace(/\s+on[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '')
  .replace(/\s+(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, ' $1="#"');
// 加载外部脚本
const scriptCache = new Map<string, Promise<HTMLScriptElement>>();
const LoadScript = (
  src: string,
  attrs?: Array<{ k: string; v: string | boolean }>
): Promise<HTMLScriptElement> => {
  if (scriptCache.has(src)) return scriptCache.get(src)!;
  const existScript = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (existScript) return Promise.resolve(existScript);
  const promise = new Promise<HTMLScriptElement>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    // 添加自定义属性
    if (attrs?.length) {
      attrs.forEach(({ k, v }) => {
        // 处理不同值类型
        const value = typeof v === "boolean"
          ? (v ? "" : null)  // 布尔值处理为 HTML 标准属性格式
          : String(v);       // 其他类型转为字符串
        if (value !== null) script.setAttribute(k, value);
      });
    }
    script.onload = () => resolve(script);
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
  scriptCache.set(src, promise);
  return promise;
};
// 加载外部CSS
const styleCache = new Map<string, Promise<HTMLLinkElement>>();
const LoadStyle = (href: string): Promise<HTMLLinkElement> => {
  if (styleCache.has(href)) return styleCache.get(href)!;
  const existStyle = document.querySelector<HTMLLinkElement>(`link[href="${href}"]`);
  if (existStyle) return Promise.resolve(existStyle);
  const promise = new Promise<HTMLLinkElement>((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = href;
    link.onload = () => resolve(link); // CSS 加载成功
    link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`)); // CSS 加载失败
    document.head.appendChild(link); // 将 <link> 添加到文档中
  });
  styleCache.set(href, promise);
  return promise;
}

// 请求封装
const $GET = async (url: string, headers: Record<string, string> = {}): Promise<any> => {
  try {
    const res = await fetch(url, { method: "GET", headers: headers, });
    if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
    return res.json();
  } catch (error) {
    console.error("GET request failed:", error);
  }
};

const $POST = async (url: string, data: Record<string, any>, headers: Record<string, string> = {}): Promise<any> => {
  try {
    const res = await fetch(url, { method: "POST", headers: { ...headers, }, body: JSON.stringify(data), });
    if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
    return res.json(); // 解析 JSON 数据
  } catch (error) {
    console.error("POST request failed:", error);
  }
};




export { $GET, $POST, getDescription, fmtTime, fmtDate, fmtPage, escapeHTML, safeUrl, sanitizeHTML, LoadScript, LoadStyle }
