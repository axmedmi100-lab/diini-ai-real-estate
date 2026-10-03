export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const script = `(function(){
    var current=document.currentScript;
    var agency=current&&current.getAttribute('data-agency-id');
    if(!agency||document.getElementById('diini-ai-widget')) return;
    var frame=document.createElement('iframe');
    frame.id='diini-ai-widget';
    frame.title='AI Property Assistant';
    frame.src='${origin}/widget/'+encodeURIComponent(agency);
    frame.style.cssText='position:fixed;right:16px;bottom:16px;width:380px;height:620px;max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);border:0;z-index:2147483647;background:transparent;';
    frame.setAttribute('allow','clipboard-write');
    document.body.appendChild(frame);
  })();`;
  return new Response(script, { headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" } });
}
