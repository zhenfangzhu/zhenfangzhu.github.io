// Layout and focus management only. The existing reading state and arithmetic stay in index.html.
let readingSurfaceActive=false;
let visibleLineCount=0;
let recollectionReading=null;
const recollectedLines=new Set();
let readingInfoDialog=null;
let readingSidebar=null;
let readingLog=null;
let readingInfoTrigger=null;
function showReadingInfo(){
 readingInfoTrigger=document.activeElement;
 readingInfoDialog.showModal();
}
function arrangeReadingSurface(){
 const active=state.step>0&&state.step<6;
 const main=document.querySelector('#main');
 const layout=document.querySelector('.layout');
 if(!readingInfoDialog){
  readingSidebar=layout.querySelector(':scope > aside');
  readingLog=document.querySelector('.wrap > details');
  readingInfoDialog=document.createElement('dialog');
  readingInfoDialog.className='focus-dialog';
  readingInfoDialog.setAttribute('aria-labelledby','readingInfoTitle');
  readingInfoDialog.innerHTML='<div class="focus-dialog-header"><h2 id="readingInfoTitle">此卦 · 卦象与说明</h2><button type="button" autofocus>回到起筮</button></div><div class="focus-dialog-content"></div>';
  readingInfoDialog.querySelector('button').onclick=()=>readingInfoDialog.close();
  readingInfoDialog.addEventListener('close',()=>{if(readingInfoTrigger?.isConnected)readingInfoTrigger.focus({preventScroll:true})});
  document.body.append(readingInfoDialog);
 }
 document.body.classList.toggle('focus-reading',active);
 if(active){
  const info=readingInfoDialog.querySelector('.focus-dialog-content');
  // Keep the original sidebar and log nodes, including their inputs and event handlers.
  readingSidebar.remove();readingLog.remove();
  info.replaceChildren();
  const context=document.createElement('div');context.className='focus-context';
  for(const [label,value] of [['此卦所问',state.question],['此卦所求',state.purpose]]){
   const heading=document.createElement('strong');heading.textContent=label;
   const p=document.createElement('p');p.textContent=value;context.append(heading,p);
  }
  info.append(context);
  const receipt=main.querySelector('.round-receipt');
  const receiptText=receipt?.querySelector('strong')?.textContent;
  for(const selector of ['.round-receipt','.classical-note','.keyboard-help']){
   const node=main.querySelector(selector);if(node)info.append(node);
  }
  info.append(readingSidebar,readingLog);
  main.querySelector('.intention')?.remove();
  const top=document.createElement('div');top.className='focus-top';
  const nav=document.createElement('div');nav.className='focus-nav';
  nav.innerHTML='<a href="/">← 个人主页</a><button type="button">卦象与说明</button>';
  nav.querySelector('button').onclick=showReadingInfo;top.append(nav);
  const values=lines();
  const live=document.createElement('aside');live.className='focus-live-hex';live.setAttribute('aria-label',`已成 ${values.length} 爻，卦爻自下而上显现`);
  live.innerHTML='<div class="live-hex-title">此间卦象 <span>'+values.length+' / 6 爻</span></div><div class="live-hex-lines">'+Array.from({length:6},(_,j)=>{
   const i=5-j,value=values[i],moving=value===6||value===9;
   return `<div class="live-hex-line ${value?'lit':'unlit'} ${moving?'moving':''} ${value&&i===values.length-1&&values.length>visibleLineCount?'just-lit':''}" aria-label="${value?lineLabel(value,i)+(moving?'，动爻':''):(names[i]+'，待成')}"><span class="live-hex-bar ${value&&value%2===0?'yin':''}"><i></i><i></i></span><span class="live-hex-label">${value?lineLabel(value,i):names[i]}${moving?' · 动':''}</span></div>`;
  }).join('')+'</div><p>爻自下生，三变添一画。</p>';
  top.append(live);
  top.append(main.querySelector('.meta'),main.querySelector('.track'));
  const question=document.createElement('button');question.type='button';question.className='focus-question';
  question.textContent='此问 · '+state.question;question.setAttribute('aria-label','查看完整所问与所求');question.onclick=showReadingInfo;top.append(question);
  const actions=main.querySelector('.actions');
  const dock=document.createElement('div');dock.className='focus-dock';
  const feedback=document.createElement('div');feedback.className='focus-feedback';feedback.setAttribute('role','status');
  feedback.textContent=receiptText||'三变成一爻 · 六爻成一卦';dock.append(feedback,actions);
  const stage=document.createElement('div');stage.className='focus-stage'+(main.querySelector('#splitRange')?' is-splitting':'');
  stage.append(...main.childNodes);main.append(top,stage,dock);
  arrangeRecollection(stage,dock);
 }
 else{
  layout.append(readingSidebar);
  (document.querySelector('#resultLogSlot')||document.querySelector('.wrap')).append(readingLog);
  if(readingInfoDialog.open)readingInfoDialog.close();
 }
 if(active!==readingSurfaceActive)window.scrollTo({top:0,behavior:'instant'});
 readingSurfaceActive=active;
 visibleLineCount=lines().length;
}
function captureReadingFocus(){
 const element=document.activeElement;
 return document.querySelector('#main').contains(element)?{id:element.id,action:element.getAttribute('onclick')}:null;
}
function restoreReadingFocus(previous){
 if(!previous)return;
 const main=document.querySelector('#main');
 const matching=previous.id?document.getElementById(previous.id):previous.action?[...main.querySelectorAll('[onclick]')].find(node=>node.getAttribute('onclick')===previous.action):null;
 const target=main.querySelector('#continueAfterRecollection')||(matching&&!matching.disabled?matching:null)||main.querySelector('#splitRange')||main.querySelector('h2');
 if(target){if(target.tagName==='H2')target.tabIndex=-1;target.focus({preventScroll:true})}
}

// A quiet pause once per line. It never advances the reading or changes stalk counts.
function arrangeRecollection(stage,dock){
 if(recollectionReading!==state.date){recollectionReading=state.date;recollectedLines.clear()}
 const lineIndex=Math.floor(state.records.length/3);
 if(state.step!==1||state.records.length%3!==0||recollectedLines.has(lineIndex))return;
 const content=document.createElement('div');content.hidden=true;content.className='recollection-content';
 content.append(...stage.childNodes);stage.append(content);
 stage.classList.remove('is-splitting');stage.classList.add('is-recollecting');
 const pause=document.createElement('section');pause.className='recollection';
 const label=document.createElement('div');label.className='eyebrow';label.textContent=names[lineIndex]+'将起 · 收心片刻';
 const heading=document.createElement('h2');heading.textContent='默念此问，意定再分。';
 const intro=document.createElement('p');intro.textContent='不必急着往下走。再读一遍心中所问，想起此筮所求。';
 pause.append(label,heading,intro);
 for(const [title,value] of [['此卦所问',state.question],['此卦所求',state.purpose]]){
  const block=document.createElement('div');block.className='recollection-question';
  const name=document.createElement('span');name.textContent=title;
  const text=document.createElement('p');text.textContent=value;
  block.append(name,text);pause.append(block);
 }
 stage.append(pause);
 dock.querySelector('.actions').hidden=true;
 dock.querySelector('.focus-feedback').textContent='意定再继续，不必赶时间。';
 const action=document.createElement('button');action.id='continueAfterRecollection';action.type='button';action.className='primary recollection-continue';action.textContent='此问在心，继续分蓍';
 action.onclick=()=>{recollectedLines.add(lineIndex);render()};dock.append(action);
}
