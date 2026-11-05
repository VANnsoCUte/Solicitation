import {initializeApp} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {getFirestore,collection,doc,addDoc,updateDoc,deleteDoc,onSnapshot} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";


import {firebaseConfig,adminEmails} from "./firebase-config.js";

const COL="solicitations";
const configured=firebaseConfig.apiKey!=="YOUR_API_KEY";
let db=null,col=null,auth=null;
if(configured){const app=initializeApp(firebaseConfig);db=getFirestore(app);auth=getAuth(app);col=collection(db,COL)}

(function(){
  var STATUSES=[
    {k:'Draft',c:'--draft'},{k:'Sent',c:'--sent'},{k:'Follow-up due',c:'--follow'},
    {k:'Pledged',c:'--pledged'},{k:'Received',c:'--received'},{k:'Declined',c:'--declined'}
  ];
  var items=[], filter='', editId=null, unsub=null;
  var $=function(id){return document.getElementById(id)};

  function fail(err){console.error(err);toast('Could not reach Firebase. Check your config and rules.')}
  function guard(){if(!configured){toast('Add your Firebase config first');return false}return true}
  function load(){
    if(!configured){$('setup').hidden=false;return}
    unsub=onSnapshot(col,function(snap){
      items=snap.docs.map(function(d){var x=d.data();x.id=d.id;return x});
      render();
    },fail);
  }
  function toast(m){var t=$('toast');t.textContent=m;t.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(function(){t.classList.remove('show')},1800)}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  
  function money(n){return Number(n||0).toLocaleString('en-PH',{style:'currency',currency:'PHP',minimumFractionDigits:2,maximumFractionDigits:2})}
  function today(){var d=new Date();return d.toISOString().slice(0,10)}
  function isOverdue(i){return i.follow&&i.follow<today()&&['Sent','Follow-up due','Draft'].indexOf(i.status)>-1}

  $('status').innerHTML=STATUSES.map(function(s){return '<option>'+s.k+'</option>'}).join('');

  function renderSummary(){
    var counts={};STATUSES.forEach(function(s){counts[s.k]=0});
    items.forEach(function(i){counts[i.status]=(counts[i.status]||0)+1});
    $('bar').innerHTML=items.length?STATUSES.map(function(s){
      return counts[s.k]?'<span title="'+s.k+': '+counts[s.k]+'" style="flex-grow:'+counts[s.k]+';background:var('+s.c+')"></span>':'';
    }).join(''):'';
    $('legend').innerHTML=STATUSES.map(function(s){
      return '<button type="button" class="chip" data-s="'+s.k+'" aria-pressed="'+(filter===s.k)+'"><i style="background:var('+s.c+')"></i>'+s.k+' <b>'+counts[s.k]+'</b></button>';
    }).join('');
    var answered=0,sentCount=0,given=0;
    items.forEach(function(i){
      
      
      given+=Number(i.amount)||0;if(i.status!=='Draft')sentCount++;
      if(['Pledged','Received','Declined'].indexOf(i.status)>-1)answered++;
    });
    var overdue=items.filter(isOverdue).length;
    $('stats').innerHTML=
      '<div><dt>Total amount given</dt><dd>'+money(given)+'</dd></div>'+
      '<div><dt>Total solicitations</dt><dd>'+items.length+'</dd></div>'+
      '<div><dt>Pledged or received</dt><dd>'+(counts['Pledged']+counts['Received'])+'</dd></div>'+
      '<div><dt>Response rate</dt><dd>'+(sentCount?Math.round(answered/sentCount*100)+'%':'–')+'</dd></div>'+
      '<div><dt>Follow-ups overdue</dt><dd'+(overdue?' class="overdue"':'')+'>'+overdue+'</dd></div>';
  }

  function renderRows(){
    var q=$('q').value.trim().toLowerCase(), tf=$('typeFilter').value;
    var list=items.filter(function(i){
      if(filter&&i.status!==filter)return false;
      if(tf&&i.type!==tf)return false;
      if(q&&(i.org+' '+i.contact+' '+i.notes).toLowerCase().indexOf(q)<0)return false;
      return true;
    }).sort(function(a,b){return (a.follow||'9999').localeCompare(b.follow||'9999')});
    $('empty').hidden=list.length>0;
    $('rows').innerHTML=list.map(function(i){
      var st=STATUSES.filter(function(s){return s.k===i.status})[0]||STATUSES[0];
      var opts=STATUSES.map(function(s){return '<option'+(s.k===i.status?' selected':'')+'>'+s.k+'</option>'}).join('');
      return '<tr data-id="'+i.id+'">'+
        '<td><div class="org">'+esc(i.org)+'</div><div class="sub">'+esc(i.contact)+'</div>'+(i.notes?'<div class="sub">'+esc(i.notes)+'</div>':'')+'</td>'+
        '<td>'+esc(i.type)+'</td>'+
        '<td><input class="amt" type="number" min="0" step="0.01" value="'+(i.amount||'')+'" placeholder="0.00" aria-label="Amount given to '+esc(i.org)+'"></td>'+
        
        '<td><input class="fu'+(isOverdue(i)?' overdue':'')+'" type="date" value="'+esc(i.follow||'')+'" aria-label="Follow up date for '+esc(i.org)+'">'+(isOverdue(i)?'<div class="sub overdue">Overdue</div>':'')+'</td>'+
        '<td><select class="st" aria-label="Status for '+esc(i.org)+'" style="color:var('+st.c+')">'+opts+'</select></td>'+
        '<td><div class="row-actions"><button class="btn edit" type="button">Edit</button><button class="btn danger del" type="button">Delete</button></div></td></tr>';
    }).join('');
  }
  function render(){renderSummary();renderRows()}

  function resetForm(){
    editId=null;
    ['org','contact','amount','sent','follow','notes'].forEach(function(f){$(f).value=''});
    $('type').selectedIndex=0;$('status').selectedIndex=0;
    $('formTitle').textContent='New solicitation';$('cancel').hidden=true;
  }

  $('save').onclick=function(){
    if(!guard())return;
    var org=$('org').value.trim();
    if(!org){toast('Enter an organization or person first');$('org').focus();return}
    var rec={org:org,contact:$('contact').value.trim(),type:$('type').value,amount:parseFloat($('amount').value)||0,
      sent:$('sent').value,follow:$('follow').value,status:$('status').value,notes:$('notes').value.trim()};
    if(editId){updateDoc(doc(db,COL,editId),rec).then(function(){toast('Changes saved')}).catch(fail)}
    else{rec.created=Date.now();addDoc(col,rec).then(function(){toast('Solicitation saved')}).catch(fail)}
    resetForm();
  };
  $('cancel').onclick=resetForm;
  $('q').oninput=renderRows;$('typeFilter').onchange=renderRows;

  $('legend').onclick=function(e){
    var b=e.target.closest('.chip');if(!b)return;
    filter=filter===b.dataset.s?'':b.dataset.s;render();
  };
  $('rows').onchange=function(e){
    if(!guard())return;
    if(e.target.classList.contains('amt')){var aid=e.target.closest('tr').dataset.id,v=Math.max(0,parseFloat(e.target.value)||0);updateDoc(doc(db,COL,aid),{amount:v}).catch(fail);e.target.value=v||'';toast('Amount saved');return}
    if(e.target.classList.contains('fu')){var fid=e.target.closest('tr').dataset.id;updateDoc(doc(db,COL,fid),{follow:e.target.value}).catch(fail);toast('Follow-up date saved');return}
    if(!e.target.classList.contains('st'))return;
    var id=e.target.closest('tr').dataset.id;
    updateDoc(doc(db,COL,id),{status:e.target.value}).catch(fail);toast('Status updated');
  };
  $('rows').onclick=function(e){
    var tr=e.target.closest('tr');if(!tr)return;var id=tr.dataset.id;
    if(e.target.classList.contains('del')){
      if(confirm('Delete this solicitation?')){deleteDoc(doc(db,COL,id)).then(function(){toast('Solicitation deleted')}).catch(fail)}
    }else if(e.target.classList.contains('edit')){
      var i=items.filter(function(x){return x.id===id})[0];if(!i)return;
      editId=id;
      $('org').value=i.org;$('contact').value=i.contact;$('type').value=i.type;$('amount').value=i.amount||'';
      $('sent').value=i.sent||'';$('follow').value=i.follow||'';$('status').value=i.status;$('notes').value=i.notes||'';
      $('formTitle').textContent='Edit solicitation';$('cancel').hidden=false;$('org').focus();
      window.scrollTo({top:0,behavior:'smooth'});
    }
  };

  $('export').onclick=function(){
    if(!items.length){toast('Nothing to export yet');return}
    var head=['Organization','Contact','Type','Amount given','Date sent','Follow up','Status','Notes'];
    var rows=items.map(function(i){return [i.org,i.contact,i.type,i.amount,i.sent,i.follow,i.status,i.notes]});
    var csv=[head].concat(rows).map(function(r){return r.map(function(v){return '"'+String(v==null?'':v).replace(/"/g,'""')+'"'}).join(',')}).join('\n');
    var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='solicitations.csv';
    document.body.appendChild(a);a.click();a.remove();
  };


  function show(signedIn){$('login').hidden=signedIn;$('app').hidden=!signedIn}
  function showErr(m){var p=$('loginErr');p.textContent=m;p.hidden=!m}
  function isAdmin(u){var e=(u.email||'').toLowerCase();return adminEmails.some(function(a){return a.toLowerCase()===e})}

  if(!configured){show(true);$('logout').hidden=true;load();render()}
  else{
    onAuthStateChanged(auth,function(user){
      if(user&&isAdmin(user)){
        $('who').textContent=user.email;show(true);showErr('');
        if(!unsub)load();
      }else{
        if(unsub){unsub();unsub=null}
        items=[];render();show(false);
        if(user){signOut(auth);showErr('This account is not an admin.')}
      }
    });
  }

  $('loginForm').onsubmit=function(e){
    e.preventDefault();showErr('');
    signInWithEmailAndPassword(auth,$('email').value.trim(),$('password').value).then(function(){
      $('password').value='';$('showPw').checked=false;$('password').type='password';
    }).catch(function(err){
      showErr(err&&err.code==='auth/too-many-requests'?'Too many attempts. Wait a few minutes and try again.':'Wrong email or password.');
    });
  };
  $('showPw').onchange=function(){$('password').type=this.checked?'text':'password'};
  $('logout').onclick=function(){if(configured)signOut(auth)};
})();
