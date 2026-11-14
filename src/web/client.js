const $=(s)=>document.querySelector(s);
const q=(selector)=>[...document.querySelectorAll(selector)];
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
let state={session:null,data:null,reviewItem:null,reviewMode:'review',changeSource:null};
const friendly={AUTH_REQUIRED:'Entre novamente para continuar.',INVALID_CREDENTIALS:'Senha incorreta.',TOO_MANY_ATTEMPTS:'Muitas tentativas. Tente novamente mais tarde.',INVALID_ORIGIN:'Origem não autorizada.',MANUAL_SYNC_COOLDOWN:'A sincronização foi solicitada recentemente. Aguarde um minuto antes de tentar de novo.',PROVIDER_NOT_CONFIGURED:'O provedor ainda não foi configurado nesta instalação.',OAUTH_STATE_INVALID_OR_EXPIRED:'A autorização expirou. Tente conectar novamente.',INSTALLATION_SECRETS_NOT_CONFIGURED:'Esta instalação ainda não tem os segredos necessários configurados.',UNEXPECTED_ERROR:'Não foi possível concluir. Verifique o estado da conexão.',POSSIBLE_DUPLICATE_REVIEW_REQUIRED:'Já existe um compromisso equivalente nesta conta. Verifique o calendário antes de tentar adicionar outro.'};
function inform(message,id='#global-error') {const box=$(id);if(!box)return;box.textContent=message;box.classList.remove('hide');}
function clear(id='#global-error'){const box=$(id);if(box)box.classList.add('hide');}
async function api(path,{method='GET',body}={}){
 const resp=await fetch(path,{method,credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store'});
 let obj={};try{obj=await resp.json();}catch{}
 if(!resp.ok)throw Error(friendly[obj.error]||obj.error||'Ocorreu um erro de conexão.');
 return obj;
}
function showApp(logged){$('#login-view').classList.toggle('hide',logged);$('#workspace').classList.toggle('hide',!logged);$('#logout').classList.toggle('hide',!logged);}
function badge(stateName){return el('span','pill '+stateName,({review:'Revisão',approved:'Aprovado',synced:'No calendário',notice:'Comunicado',ignored:'Ignorado'})[stateName]||stateName);}
function button(label,fn,cls='button outline small') {const b=el('button',cls,label);b.type='button';b.addEventListener('click',fn);return b;}
function chooseTab(tab){
 q('.tab').forEach(t=>{const active=t.dataset.tab===tab;t.classList.toggle('active',active);t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1;});
 q('.tab-view').forEach(panel=>panel.classList.toggle('hide',panel.id!=='panel-'+tab));
}

function renderProviderCards(){
 const host=$('#provider-selection');host.replaceChildren();const other=$('#other-providers');if(other)other.replaceChildren();
 for(const [name,title,short,icon] of [['gmail','Gmail','Google Workspace','G'],['outlook','Outlook','Microsoft 365','O']]){
  const enabled=state.session?.providers?.[name];const b=el('button','provider');b.type='button';b.disabled=!enabled;
  const emblem=el('div','provider-icon',icon);const box=el('div');box.append(el('strong','',title),el('span','',enabled?'Conectar minha conta':'Aguardando configuração OAuth'));b.append(emblem,box);
  b.addEventListener('click',async()=>{clear();b.disabled=true;try{const result=await api('/api/oauth/start',{method:'POST',body:{provider:name}});window.location.assign(result.url);}catch(e){inform(e.message);b.disabled=false;}});
  host.append(b);if(other){const cloned=b.cloneNode(true);cloned.addEventListener('click',()=>b.click());other.append(cloned);}
 }
}
function renderConnections(conns){
 for(const selector of ['#connections-home','#connections-settings']){
  const container=$(selector);container.replaceChildren();
  if(!conns.length){container.append(el('p','empty','Nenhuma conta conectada. Escolha Gmail ou Outlook para começar.'));continue;}
  for(const conn of conns){const card=el('div','connection'),left=el('div'),right=el('div','row-actions');
   left.append(el('div','connection-title',(conn.provider==='gmail'?'Gmail':'Outlook')+' · '+conn.account_hint));
   const last=conn.last_sync_at?new Date(conn.last_sync_at).toLocaleString('pt-BR'):'Ainda não sincronizado';
   left.append(el('div','connection-meta','Última verificação: '+last));
   if(!conn.enabled)left.append(el('div','status-text','Conexão pausada. Revise seu calendário antes de retomar.'));
   if(conn.last_error)left.append(el('div','status-text','Atenção: '+conn.last_error));else left.append(el('div','connection-meta',conn.calendar_ready?'Calendário Aurora conectado':'Calendário será preparado na primeira ação aprovada'));
   if(selector==='#connections-settings'){if(!conn.enabled)right.append(button('Retomar',async()=>{if(!window.confirm('Confira o calendário e as ações pendentes antes de reativar. Deseja continuar?'))return;try{await api('/api/connections/'+conn.id+'/resume',{method:'POST',body:{confirm:true}});await refresh();}catch(e){inform(e.message);}},'button primary small'));right.append(button('Desconectar',()=>disconnect(conn.id)));}
   card.append(left,right);container.append(card);
  }
 }
}
function renderMonitoring(connections){
 const host=$('#monitoring-settings');if(!host)return;host.replaceChildren();
 if(!connections.length){host.append(el('p','muted','Conecte Gmail ou Outlook para definir as regras.'));return;}
 const labels={academic_strict:'Acadêmico (padrão)',academic_extended:'Acadêmico ampliado',personal:'Pessoal — ativação explícita'};
 const keys=[['allowed_senders','Remetentes permitidos (um por linha)','professor@exemplo.edu.br'],['allowed_domains','Domínios permitidos (um por linha)','faculdade.edu.br'],['blocked_senders','Remetentes bloqueados','anuncios@exemplo.com'],['blocked_domains','Domínios bloqueados','ofertas.exemplo.com']];
 for(const conn of connections){
  const existing=state.data?.monitoring?.[conn.id]||{mode:'academic_strict',allowed_senders:[],allowed_domains:[],blocked_senders:[],blocked_domains:[],sensitive_opt_in:false};
  const wrapper=el('section','monitoring-account'),title=el('h3','',conn.account_hint),form=el('form','monitoring-form');wrapper.append(title);
  const modeLabel=el('label','','Perfil desta conta');const mode=el('select');mode.id='monitor-mode-'+conn.id;modeLabel.setAttribute('for',mode.id);
  for(const [id,label] of Object.entries(labels)){const opt=el('option','',label);opt.value=id;mode.append(opt);}mode.value=existing.mode;
  form.append(modeLabel,mode);
  const lists={};for(const [key,label,placeholder] of keys){const field=el('label','',label),input=el('textarea');input.rows=2;input.maxLength=2048;input.placeholder=placeholder;input.id=key+'-'+conn.id;field.setAttribute('for',input.id);input.value=(existing[key]||[]).join('\n');lists[key]=input;form.append(field,input);}
  const opt=el('label','monitor-checkbox'),check=el('input');check.type='checkbox';check.checked=Boolean(existing.sensitive_opt_in);check.id='sensitive-'+conn.id;opt.setAttribute('for',check.id);opt.append(check,el('span','','Incluir assuntos sensíveis (saúde e finanças) no modo pessoal — exige revisão antes de qualquer ação.'));form.append(opt);
  const submit=el('button','button primary small','Salvar perfil e filtros');submit.type='submit';form.append(submit);
  const counts=(state.data?.monitoringCounts||[]).filter(x=>x.connection_id===conn.id).reduce((n,x)=>n+Number(x.total||0),0);
  const pending=Number((state.data?.monitoringSkips||[]).find(x=>x.connection_id===conn.id)?.total||0);
  wrapper.append(el('p','muted small',counts+' decisões históricas de triagem por metadados. '+pending+' mensagens marcadas como dispensadas. O Aurora pode deixar avisos importantes de fora se suas fontes não estiverem configuradas.'));
  if(pending){const rescan=button('Reavaliar até 12 mensagens dispensadas',async()=>{
   if(!window.confirm('Reavaliar mensagens dispensadas dos últimos 30 dias? Isso pode consumir mais chamadas de API. O Aurora não criará compromissos sem sua confirmação.'))return;
   try{const out=await api('/api/connections/'+conn.id+'/monitoring/rescan',{method:'POST',body:{confirm:true}});inform(out.requeued+' mensagens colocadas na fila. '+out.notice);await refresh();}catch(e){inform(e.message);}
  });wrapper.append(rescan);}

  form.addEventListener('submit',async event=>{
   event.preventDefault();const modeChoice=mode.value;
   if(modeChoice==='personal'&&existing.mode!=='personal'&&!window.confirm('Ativar análise pessoal desta conta? O Aurora poderá ler o conteúdo das mensagens cujos metadados corresponderem aos filtros.'))return;
   if(check.checked&&!existing.sensitive_opt_in&&!window.confirm('Incluir assuntos sensíveis como saúde e finanças? Eles sempre exigirão confirmação antes de qualquer ação.'))return;
   const parsed={};for(const [key] of keys)parsed[key]=lists[key].value.split(/[\n,]/).map(x=>x.trim().toLowerCase()).filter(Boolean);
   submit.disabled=true;
   try{const result=await api('/api/connections/'+conn.id+'/monitoring',{method:'POST',body:{mode:modeChoice,...parsed,sensitive_opt_in:check.checked}});inform('Preferências salvas. '+result.notice);await refresh();}
   catch(e){inform(e.message);}finally{submit.disabled=false;}
  });
  wrapper.append(form);host.append(wrapper);
 }
}
function itemRow(item){
 const row=el('div','item'),details=el('div'),actions=el('div','row-actions');
 details.append(el('h3','',item.title),badge(item.state));
 const subtitle= item.start_at ? 'Data e hora: '+new Date(item.start_at+'-03:00').toLocaleString('pt-BR') : item.due_date ? 'Prazo: '+item.due_date.split('-').reverse().join('/') : ({notice:'Informativo',review:'Ainda falta confirmar informações',task:'Atividade'})[item.kind]||'Sem data confirmada';
 details.append(el('p','item-meta',subtitle));
 if(item.rationale)details.append(el('p','item-desc',item.rationale));
 if(item.state==='review'){
  const isCorrection=(item.rationale||'').includes('Comunicado menciona alteração ou cancelamento');
  actions.append(button(isCorrection?'Conferir alteração':'Revisar',()=>isCorrection?openChangeReview(item):openReview(item),'button primary small'));
  actions.append(button('Ignorar',async()=>{if(!window.confirm('Marcar este comunicado como ignorado? Nenhum evento será criado.'))return;try{await api('/api/items/'+item.id+'/ignore',{method:'POST',body:{confirm:true}});await refresh();}catch(e){inform(e.message);}}));
  if(isCorrection)details.append(el('p','status-text','Se isto altera um compromisso já existente, abra o compromisso original e escolha Corrigir ou Cancelar. Não crie um segundo evento.'));
 }
 if(item.state==='synced'&&['event','task'].includes(item.kind)){
  actions.append(button('Corrigir',()=>openReview(item,'update')));
  actions.append(button('Cancelar da agenda',async()=>{
   if(!window.confirm('Cancelar exclusivamente este compromisso criado pelo Aurora? O e-mail original será preservado.'))return;
   try{await api('/api/items/'+item.id+'/calendar-change',{method:'POST',body:{action:'cancel',confirm:true}});inform('Cancelamento registrado. A sincronização confirmará o resultado.');await refresh();}catch(e){inform(e.message);}
  }));
 }
 row.append(details,actions);return row;
}
function renderItems(items){
 const list=$('#items-list');list.replaceChildren();
 const needle=($('#item-search').value||'').trim().toLocaleLowerCase('pt-BR');const filter=$('#item-filter').value;
 const relevant=items.filter(i=>i.state!=='ignored'&&(filter==='all'||i.kind===filter||(filter==='review'&&i.state==='review'))&&(!needle||i.title.toLocaleLowerCase('pt-BR').includes(needle)||(i.rationale||'').toLocaleLowerCase('pt-BR').includes(needle)));
 if(!relevant.length)list.append(el('div','card empty','Ainda não há comunicados processados. Eles aparecerão aqui após a conexão e a sincronização.'));
 else for(const item of relevant){const card=el('div','card');card.append(itemRow(item));list.append(card);}
 const upcoming=$('#upcoming');upcoming.replaceChildren();
 const today=new Date().toISOString().slice(0,10);
 const recent=items.filter(i=>i.state==='synced'||i.state==='approved').filter(i=>(i.start_at||i.due_date||'')>=today).sort((a,b)=>(a.start_at||a.due_date||'').localeCompare(b.start_at||b.due_date||'')).slice(0,5);
 if(!recent.length)upcoming.append(el('div','empty','Seus próximos compromissos aparecerão aqui.'));
 for(const item of recent)upcoming.append(itemRow(item));
 $('#stat-review').textContent=String(items.filter(x=>x.state==='review').length);
 $('#stat-tasks').textContent=String(items.filter(x=>x.kind==='task'&&x.state!=='ignored').length);
 $('#stat-synced').textContent=String(items.filter(x=>x.state==='synced').length);
}
function renderOutbox(entries){const box=$('#outbox-list');box.replaceChildren();const changes=state.data?.changes||[],stuck=state.data?.stuck||[];if(!entries.length&&!changes.length&&!stuck.length)box.append(el('p','empty','Nenhuma ação pendente.'));
 for(const a of entries){const row=el('div','action'),left=el('div');left.append(el('div','connection-title','Ação de calendário — '+a.state));left.append(el('div','connection-meta',a.last_error||'Aguardando processamento.'));row.append(left);
 if(a.state==='blocked')row.append(button('Verificar e tentar novamente',async()=>{
  if(!window.confirm('Existe risco de duplicidade se o provedor criou o evento e não respondeu. Verifique seu calendário antes de continuar. Deseja solicitar outra tentativa?'))return;
  try{await api('/api/outbox/'+a.id+'/retry',{method:'POST',body:{confirmRisk:true}});await refresh();}catch(e){inform(e.message)}
 }));box.append(row);
 }
 for(const change of changes){const row=el('div','action'),main=el('div');main.append(el('div','connection-title','Correção/cancelamento: '+change.action+' — '+change.state));main.append(el('div','connection-meta',change.last_error||'Aguardando agendamento.'));row.append(main);
  if(change.state==='blocked')row.append(button('Revisar e tentar novamente',async()=>{if(!window.confirm('Verifique o evento no calendário: uma alteração anterior pode ter sido aplicada. Confirmar nova tentativa?'))return;try{await api('/api/calendar-changes/'+change.id+'/retry',{method:'POST',body:{confirmRisk:true}});await refresh();}catch(e){inform(e.message);}}));box.append(row);
 }
 for(const failed of stuck){const row=el('div','action'),main=el('div');main.append(el('div','connection-title','Comunicado não processado — tentativas esgotadas'));main.append(el('div','connection-meta',failed.last_error||'Falha de leitura'));row.append(main,button('Tentar ler novamente',async()=>{if(!window.confirm('Deseja reiniciar as tentativas de leitura deste comunicado?'))return;try{await api('/api/inbox/'+failed.id+'/retry',{method:'POST',body:{confirm:true}});await refresh();}catch(e){inform(e.message);}}));box.append(row);
 }
}
async function refresh(){const data=await api('/api/data');state.data=data;if(data.preferences){$('#pref-event').value=String(data.preferences.event_reminder_minutes);$('#pref-task').value=String(data.preferences.task_reminder_minutes);}renderConnections(data.connections);renderMonitoring(data.connections);renderItems(data.items);renderOutbox(data.outbox);
 const usage=data.usage||{},limitWarning=(usage.provider_calls??0)>=450||(usage.mail_reads??0)>=180||(usage.calendar_writes??0)>=25;
 $('#quota-status').textContent=limitWarning?'Atenção: o Aurora está próximo de seu limite diário de segurança. Algumas verificações poderão aguardar até amanhã.':'Proteção gratuita: '+(usage.provider_calls??0)+' de 500 chamadas de provedor reservadas hoje. Esta contagem não equivale à cobrança da Cloudflare.';const connected=data.connections.length>0;$('#onboarding').classList.toggle('hide',connected);$('#setup-step').textContent=connected?'3':'1';renderProviderCards();}
async function disconnect(id){if(!window.confirm('Desconectar apagará os registros locais desta conta. Eventos já criados continuarão na sua agenda. Confirma?'))return;try{await api('/api/connections/'+id+'/disconnect',{method:'POST',body:{confirm:true}});await refresh();}catch(e){inform(e.message);}}
function openReview(item,mode='review'){
 modalFocusReturn.review=document.activeElement;
 state.reviewItem=item;state.reviewMode=mode;
 $('#review-heading').textContent=mode==='update'?'Corrigir evento no calendário':'Revisar informação';
 $('#review-context').textContent=item.title+' — '+(mode==='update'?'Uma correção será enviada apenas ao calendário do Aurora.':item.rationale);
 $('#review-modal').classList.remove('hide');$('#review-kind').disabled=mode==='update';
 $('#review-kind').value=(item.kind==='task'||item.kind==='event')?item.kind:'event';
 $('#review-date').value=item.due_date||item.start_at?.slice(0,10)||'';
 $('#review-time').value=item.start_at?.slice(11,16)||'09:00';
 $('#review-time-wrap').classList.toggle('hide',$('#review-kind').value!=='event');
 $('#review-time').required=$('#review-kind').value==='event';$('#review-date').focus();
}
function closeReview(){$('#review-modal').classList.add('hide');state.reviewItem=null;state.reviewMode='review';$('#review-kind').disabled=false;modalFocusReturn.review?.focus?.();}
function openChangeReview(message){
 modalFocusReturn.change=document.activeElement;
 const candidates=(state.data?.items||[]).filter(i=>i.state==='synced'&&['event','task'].includes(i.kind));
 if(!candidates.length){inform('Nenhum compromisso sincronizado encontrado. Você pode ignorar este comunicado e conferir seu calendário diretamente.');return;}
 state.changeSource=message;
 $('#change-review-summary').textContent=message.title;
 const select=$('#change-target');select.replaceChildren();
 const empty=el('option','','Escolha o compromisso original');empty.value='';select.append(empty);
 for(const item of candidates){const opt=el('option','',item.title+' — '+(item.start_at?.slice(0,16)||item.due_date||'sem data'));opt.value=item.id;select.append(opt);}
 $('#change-date').value='';$('#change-time').value='09:00';$('#change-action').value='update';
 $('#change-review-modal').classList.remove('hide');select.focus();toggleChangeFields();
}
function closeChangeReview(){$('#change-review-modal').classList.add('hide');state.changeSource=null;modalFocusReturn.change?.focus?.();}
function toggleChangeFields(){const updating=$('#change-action').value==='update';$('#change-new-date').classList.toggle('hide',!updating);$('#change-date').required=updating;const target=state.data?.items.find(i=>i.id===$('#change-target').value);const needsTime=updating&&target?.kind==='event';$('#change-new-time').classList.toggle('hide',!needsTime);$('#change-time').required=Boolean(needsTime);if(target){$('#change-date').value=target.due_date||target.start_at?.slice(0,10)||'';$('#change-time').value=target.start_at?.slice(11,16)||'09:00';}}
$('#change-review-close').addEventListener('click',closeChangeReview);
$('#change-action').addEventListener('change',toggleChangeFields);$('#change-target').addEventListener('change',toggleChangeFields);
$('#change-review-form').addEventListener('submit',async event=>{
 event.preventDefault();const source=state.changeSource,target=state.data?.items.find(i=>i.id===$('#change-target').value);if(!source||!target){inform('Escolha um compromisso existente.');return;}
 const action=$('#change-action').value;
 if(!window.confirm(action==='cancel'?'Cancelar o compromisso selecionado, sem apagar o e-mail original?':'Confirmar remarcação deste compromisso na agenda?'))return;
 const payload=action==='cancel'?{action:'cancel',confirm:true}:target.kind==='event'?{action:'update',start_at:$('#change-date').value+'T'+$('#change-time').value+':00'}:{action:'update',due_date:$('#change-date').value};
 try{await api('/api/items/'+target.id+'/calendar-change',{method:'POST',body:payload});
  await api('/api/items/'+source.id+'/ignore',{method:'POST',body:{confirm:true}});
  closeChangeReview();inform('Alteração registrada. O Aurora verificará a propriedade do evento antes de agir.');await refresh();
 }catch(error){inform(error.message);}
});
async function initialize(){
 try{state.session=await api('/api/session');showApp(state.session.logged_in);if(state.session.logged_in)await refresh();}
 catch(e){showApp(false);inform(e.message,'#login-error');}
 if(new URLSearchParams(location.search).has('oauth_error'))inform('Não foi possível conectar a conta. Verifique as permissões ou peça autorização à instituição.');
 if(new URLSearchParams(location.search).has('connected')){clear();history.replaceState({},'',location.pathname);}
}
$('#login-form').addEventListener('submit',async(e)=>{e.preventDefault();clear('#login-error');const btn=e.submitter;btn.disabled=true;try{await api('/api/login',{method:'POST',body:{passphrase:$('#passphrase').value}});$('#passphrase').value='';await initialize();}catch(ex){inform(ex.message,'#login-error')}finally{btn.disabled=false;}});
$('#logout').addEventListener('click',async()=>{try{await api('/api/logout',{method:'POST'});}finally{state.data=null;await initialize();}});
$('#sync').addEventListener('click',async(e)=>{const b=e.currentTarget;b.disabled=true;clear();b.textContent='Verificando…';try{await api('/api/sync',{method:'POST'});await refresh();}catch(ex){inform(ex.message)}finally{b.disabled=false;b.textContent='↻ Verificar e-mails';}});
q('.tab').forEach(b=>{
 b.addEventListener('click',()=>chooseTab(b.dataset.tab));
 b.addEventListener('keydown',event=>{
  const tabs=q('.tab');const at=tabs.indexOf(b);
  const next=event.key==='ArrowRight'?tabs[(at+1)%tabs.length]:event.key==='ArrowLeft'?tabs[(at-1+tabs.length)%tabs.length]:event.key==='Home'?tabs[0]:event.key==='End'?tabs[tabs.length-1]:null;
  if(next){event.preventDefault();chooseTab(next.dataset.tab);next.focus();}
 });
});
$('#review-kind').addEventListener('change',()=>{$('#review-time-wrap').classList.toggle('hide',$('#review-kind').value!=='event');$('#review-time').required=$('#review-kind').value==='event';});
$('#review-cancel').addEventListener('click',closeReview);
$('#review-form').addEventListener('submit',async(e)=>{e.preventDefault();const item=state.reviewItem;if(!item)return;
 const kind=$('#review-kind').value,date=$('#review-date').value,time=$('#review-time').value;const body=kind==='event'?{kind,start_at:date+'T'+time+':00'}:{kind,due_date:date};
 try{
  if(state.reviewMode==='update')await api('/api/items/'+item.id+'/calendar-change',{method:'POST',body:{action:'update',...(kind==='event'?{start_at:body.start_at}:{due_date:body.due_date})}});
  else await api('/api/items/'+item.id+'/review',{method:'POST',body});
  closeReview();await refresh();}catch(ex){inform(ex.message);closeReview();}
});
initialize();

async function exportAllData(){
 const control=$('#export-data');control.disabled=true;control.textContent='Preparando exportação…';
 try{
  const items=[];let cursor=null,connections=[];
  for(let page=0;page<1000;page++){
   const res=await api('/api/export'+(cursor?'?cursor='+encodeURIComponent(cursor):''));
   if(page===0)connections=res.connections;
   items.push(...res.items);
   if(!res.partial){cursor=null;break;}
   if(!res.next_cursor||res.next_cursor===cursor)throw Error('Exportação interrompida: cursor inválido');
   cursor=res.next_cursor;
  }
  if(cursor)throw Error('Exportação muito grande: use os lotes pela API.');
  const blob=new Blob([JSON.stringify({version:2,exported_at:new Date().toISOString(),connections,items},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download='aurora-dados-'+new Date().toISOString().slice(0,10)+'.json';
  anchor.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
 }catch(e){inform(e.message);}finally{control.disabled=false;control.textContent='Exportar todos os meus dados';}
}
$('#export-data').addEventListener('click',exportAllData);
async function refreshSessions(){
 const host=$('#sessions-list');host.replaceChildren(el('p','muted','Carregando sessões…'));
 try{const data=await api('/api/sessions');const active=data.sessions.filter(x=>!x.revoked_at&&x.expires_at>Date.now());host.replaceChildren();
  if(!active.length)host.append(el('p','muted','Nenhuma sessão ativa.'));
  for(const session of active){const row=el('div','action'),label=el('div');
   const mine=session.id_hash===data.current;label.append(el('strong','',mine?'Este aparelho':'Outra sessão'));label.append(el('p','small muted','Início: '+new Date(session.created_at).toLocaleString('pt-BR')));row.append(label);
   if(!mine)row.append(button('Revogar acesso',async()=>{
    if(!window.confirm('Revogar esta sessão em outro aparelho?'))return;
    try{await api('/api/sessions/'+session.id_hash+'/revoke',{method:'POST',body:{confirm:true}});await refreshSessions();}catch(e){inform(e.message);}
   }));host.append(row);
  }
 }catch(e){host.replaceChildren(el('p','status-text',e.message));}
}
$('#refresh-sessions').addEventListener('click',refreshSessions);
q('[data-tab="settings"]').forEach(b=>b.addEventListener('click',()=>{if(state.session?.logged_in)refreshSessions();}));

$('#preferences-form').addEventListener('submit',async(e)=>{e.preventDefault();clear();try{await api('/api/preferences',{method:'POST',body:{event_reminder_minutes:Number($('#pref-event').value),task_reminder_minutes:Number($('#pref-task').value)}});await refresh();}catch(ex){inform(ex.message);}});

// Progressive installation is optional; automation runs on the server's cron.
const modalFocusReturn={review:null,change:null};
let deferredInstall=null;
const platform=/iPhone|iPad|iPod/i.test(navigator.userAgent)?'ios':/Android/i.test(navigator.userAgent)?'android':'desktop';
function updateInstallInstructions(){
 const text=platform==='ios'?'No iPhone/iPad, abra o menu Compartilhar do navegador e escolha Adicionar à Tela de Início. O botão de instalação não é oferecido pelo iOS.':platform==='android'?'No Android, procure Instalar aplicativo no menu do navegador. Se o botão estiver disponível, use-o.':'No computador, utilize Instalar aplicativo no menu do Chrome ou Edge. Outros navegadores podem ter opções diferentes.';
 $('#install-instructions').textContent=window.matchMedia('(display-mode: standalone)').matches?'O Aurora já está aberto como aplicativo neste aparelho.':text;
 const canPrompt=Boolean(deferredInstall)&&!window.matchMedia('(display-mode: standalone)').matches;
 $('#install-guide-btn').classList.toggle('hide',!canPrompt);$('#install-app').classList.toggle('hide',!canPrompt);
}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstall=event;updateInstallInstructions();});
window.addEventListener('appinstalled',()=>{deferredInstall=null;updateInstallInstructions();});
async function requestInstall(){if(!deferredInstall)return;const event=deferredInstall;deferredInstall=null;try{await event.prompt();await event.userChoice;}catch{}updateInstallInstructions();}
$('#install-app').addEventListener('click',requestInstall);
$('#install-guide-btn').addEventListener('click',requestInstall);
function connectionState(){const offline=!navigator.onLine;$('#offline-banner').classList.toggle('hide',!offline);if(offline)clear();}
window.addEventListener('online',connectionState);window.addEventListener('offline',connectionState);connectionState();updateInstallInstructions();
async function refreshDiagnostics(){
 const host=$('#diagnostics');host.replaceChildren(el('p','muted','Consultando configuração…'));
 try{const status=await api('/api/diagnostics');const dl=el('dl');
  for(const [title,value] of [['Banco de dados',status.database?'Acessível':'Não acessível'],['Gmail',status.providers.gmail?'Configuração OAuth presente':'Necessita configurar OAuth'],['Criação automática',status.automation_mode||'Revisão humana'],['Outlook',status.providers.outlook?'Configuração OAuth presente':'Necessita configurar OAuth'],['Contas conectadas',String(status.connections)],['Conexões com erro',String(status.connections_with_error)],['Mensagens aguardando processamento',String(status.pending_messages??'—')],['Maior atraso de item pendente',(status.oldest_pending_minutes??'—')+' minutos'],['Última checagem',new Date(status.checked_at).toLocaleString('pt-BR')],['Agendamento de servidor',status.cron_status]]){
   dl.append(el('dt','',title),el('dd','',value));
  }
  host.replaceChildren(dl);
 }catch(e){host.replaceChildren(el('p','status-text',e.message));}
}
$('#refresh-diagnostics').addEventListener('click',refreshDiagnostics);
// Refresh diagnostics only when entering the dedicated tab.
q('[data-tab="guide"]').forEach(b=>b.addEventListener('click',()=>{if(state.session?.logged_in)refreshDiagnostics();}));
if('serviceWorker'in navigator&&(['https:','http:'].includes(location.protocol))){
 window.addEventListener('load',()=>{
  if(location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname)){
   navigator.serviceWorker.register('/sw.js',{scope:'/'}).then(reg=>{
    if(reg.waiting)notifyUpdate(reg);
    reg.addEventListener('updatefound',()=>{const worker=reg.installing;if(worker)worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)notifyUpdate(reg);});});
   }).catch(()=>{});
  }
 });
}
function notifyUpdate(reg){const container=$('#global-error');if(!container||!reg.waiting)return;
 // User confirmation avoids destroying an unfinished review form.
 const action=button('Atualizar Aurora',()=>{if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});});
 container.replaceChildren(el('span','','Nova versão disponível. Salve alterações antes de atualizar.'),action);container.classList.remove('hide');
}
if(navigator.serviceWorker)navigator.serviceWorker.addEventListener('controllerchange',()=>{location.reload();});

$('#item-search').addEventListener('input',()=>{if(state.data)renderItems(state.data.items);});
$('#item-filter').addEventListener('change',()=>{if(state.data)renderItems(state.data.items);});

// Keyboard-accessible modal focus containment and Escape handling.
document.addEventListener('keydown',event=>{
 const active=['#change-review-modal','#review-modal'].map(sel=>$(sel)).find(node=>node&&!node.classList.contains('hide'));
 if(!active)return;
 if(event.key==='Escape'){event.preventDefault();if(active.id==='review-modal')closeReview();else closeChangeReview();return;}
 if(event.key!=='Tab')return;
 const nodes=[...active.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]')].filter(node=>!node.closest('.hide')&&node.getClientRects().length>0);
 if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
});

// Opt-in Web Push: activation requires a direct gesture, never page load.
async function refreshPush(){
 const status=$('#push-status');if(!status)return;
 try{const result=await api('/api/push/config');state.push=result;
  status.textContent=!result.enabled?'Este servidor ainda não configurou Web Push. Os lembretes do calendário seguem funcionando.':result.subscriptions.length?'Há dispositivos com notificações ativas nesta instalação.':'Não ativado neste dispositivo (opcional).';
  if(result.quiet_hours){$('#quiet-start').value=result.quiet_hours.quiet_start;$('#quiet-end').value=result.quiet_hours.quiet_end;$('#quiet-zone').value=result.quiet_hours.quiet_zone;}
 }catch(e){status.textContent=e.message;}
}
q('[data-tab="settings"]').forEach(b=>b.addEventListener('click',()=>{if(state.session?.logged_in)refreshPush();}));
$('#push-enable').addEventListener('click',async()=>{
 const btn=$('#push-enable');btn.disabled=true;
 try{const cfg=await api('/api/push/config');
  if(!cfg.enabled)throw Error('Notificações próprias não foram configuradas pelo responsável desta instalação.');
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))throw Error('Este navegador não oferece Web Push. Use o aplicativo de calendário.');
  if(/iPad|iPhone|iPod/.test(navigator.userAgent)&&!window.matchMedia('(display-mode: standalone)').matches)throw Error('No iPhone, instale primeiro o Aurora na Tela de Início.');
  const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('Permissão não concedida; o calendário continua funcionando.');
  const reg=await navigator.serviceWorker.ready;
  const key=Uint8Array.from(atob(cfg.public_key.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-cfg.public_key.length%4)%4)),c=>c.charCodeAt(0));
  let subscription=await reg.pushManager.getSubscription();
  if(!subscription)subscription=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
  const data=subscription.toJSON();await api('/api/push/subscribe',{method:'POST',body:{endpoint:data.endpoint,keys:data.keys}});
  await refreshPush();
 }catch(e){inform(e.message);}finally{btn.disabled=false;}
});
$('#push-disable').addEventListener('click',async()=>{
 try{const cfg=await api('/api/push/config');for(const x of cfg.subscriptions)await api('/api/push/unsubscribe',{method:'POST',body:{id:x.id}});
  if('serviceWorker'in navigator){const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager?.getSubscription();if(sub)await sub.unsubscribe();}
  await refreshPush();
 }catch(e){inform(e.message);}
});
$('#quiet-hours-form').addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/push/preferences',{method:'POST',body:{quiet_start:$('#quiet-start').value,quiet_end:$('#quiet-end').value,quiet_zone:$('#quiet-zone').value}});await refreshPush();inform('Horário de silêncio atualizado.');}catch(error){inform(error.message);}});

async function refreshOnboarding(){
 const host=$('#onboarding-live-status');try{const result=await api('/api/onboarding');
  const names={IDENTITY_CONFIGURED:'Configurar o aplicativo OAuth (Gmail ou Outlook)',ACCOUNT_CONNECTED:'Conectar sua conta acadêmica',CALENDAR_TESTED:'Confirmar um compromisso para testar o calendário',NOTIFICATIONS_OPT_IN_OR_SKIPPED:'Ativar ou pular as notificações opcionais'};
  host.textContent=result.complete?'Configuração básica verificada. Confira periodicamente os diagnósticos.':'Próximo passo: '+(names[result.next]||'Conferir instalação');
 }catch(e){host.textContent=e.message;}
}
$('#onboarding-check').addEventListener('click',refreshOnboarding);
$('#skip-push-onboarding').addEventListener('click',async()=>{try{await api('/api/onboarding/skip-notifications',{method:'POST',body:{confirm:true}});await refreshOnboarding();inform('Você pode ativar notificações mais tarde.');}catch(e){inform(e.message);}});
