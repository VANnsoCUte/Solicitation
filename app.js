(function(){
var firebaseConfig = window.firebaseConfig || {};

var $=function(i){return document.getElementById(i)};
var recs=[],editId=null,col=null;
var configured=firebaseConfig.apiKey&&firebaseConfig.apiKey.indexOf("YOUR_")!==0&&window.firebase;

function note(t,bad){var m=$("msg");m.textContent=t;m.style.color=bad?"var(--er)":"var(--mu)";m.classList.toggle("hide",!t)}
function lsLoad(){try{return JSON.parse(localStorage.getItem("st_records")||"[]")}catch(e){return[]}}
function lsSave(){try{localStorage.setItem("st_records",JSON.stringify(recs))}catch(e){}}

/* ---- Storage layer: Firestore if configured, otherwise browser storage ---- */
var unsub=null;
function showApp(on){$("app").classList.toggle("hide",!on);$("login").classList.toggle("hide",on)}
function startData(){
  note("Connecting to Firebase…");
  unsub=col.onSnapshot(function(snap){
    recs=snap.docs.map(function(d){return d.data()});
    note(snap.metadata.fromCache&&snap.metadata.hasPendingWrites?"Saving…":"");
    render();
  },function(err){note("Firebase error: "+err.message+" (check your Firestore rules and config).",true)});
}
function stopData(){if(unsub){unsub();unsub=null}recs=[];render()}
if(configured){
  try{
    firebase.initializeApp(firebaseConfig);
    col=firebase.firestore().collection("solicitations");
    $("out").classList.remove("hide");
    firebase.auth().onAuthStateChanged(function(u){
      if(u){showApp(true);startData()}else{stopData();showApp(false)}
    });
  }catch(e){note("Firebase setup failed: "+e.message,true);col=null;recs=lsLoad();showApp(true)}
}else{
  recs=lsLoad();showApp(true);
  note("Firebase is not connected yet. Data is saved in this browser only. Paste your settings into firebase-config.js.",true);
}
$("lbtn").onclick=function(){
  var e=$("lerr");e.textContent="";
  var u=$("lu").value.trim(),p=$("lp").value;
  if(!u||!p){e.textContent="Enter your email and password.";return}
  $("lbtn").disabled=true;
  firebase.auth().signInWithEmailAndPassword(u,p).then(function(){$("lp").value=""}).catch(function(err){
    e.textContent=/invalid|wrong|not-found|credential/i.test(err.code+err.message)?"Wrong email or password.":err.message;
  }).then(function(){$("lbtn").disabled=false});
};
["lu","lp"].forEach(function(i){$(i).onkeydown=function(ev){if(ev.key==="Enter")$("lbtn").click()}});
$("showpw").onchange=function(){$("lp").type=this.checked?"text":"password"};
$("out").onclick=function(){firebase.auth().signOut()};
function put(r){
  if(col){col.doc(r.id).set(r).catch(function(e){note("Could not save: "+e.message,true)})}
  else{var i=recs.findIndex(function(x){return x.id===r.id});if(i>-1)recs[i]=r;else recs.unshift(r);lsSave();render()}
}
function remove(id){
  if(col){col.doc(id).delete().catch(function(e){note("Could not delete: "+e.message,true)})}
  else{recs=recs.filter(function(x){return x.id!==id});lsSave();render()}
}

function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function peso(n){return "₱"+(Number(n)||0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}
function today(){var d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10)}

function clearForm(){
  editId=null;["fName","fContact","fAmt","fFu","fRem"].forEach(function(i){$(i).value=""});
  $("fDate").value=today();$("fType").selectedIndex=0;$("fSt").selectedIndex=0;
  $("fh").textContent="Add solicitation";$("cancel").classList.add("hide");$("save").textContent="Save record";
}
$("save").onclick=function(){
  var name=$("fName").value.trim();if(!name){alert("Please enter the solicitor's name.");$("fName").focus();return}
  put({id:editId||("r"+Date.now()+Math.floor(Math.random()*1000)),date:$("fDate").value||today(),name:name,type:$("fType").value,contact:$("fContact").value.trim(),amount:parseFloat($("fAmt").value)||0,fu:$("fFu").value,status:$("fSt").value,remarks:$("fRem").value.trim()});
  clearForm();
};
$("cancel").onclick=clearForm;
function edit(id){
  var r=recs.find(function(x){return x.id===id});if(!r)return;editId=id;
  $("fDate").value=r.date;$("fName").value=r.name;$("fType").value=r.type;$("fContact").value=r.contact;$("fAmt").value=r.amount||"";$("fFu").value=r.fu;$("fSt").value=r.status;$("fRem").value=r.remarks;
  $("fh").textContent="Edit solicitation";$("save").textContent="Update record";$("cancel").classList.remove("hide");
  window.scrollTo({top:0,behavior:"smooth"});
}
var fuOnly=false;
function isFu(r){return !!r.fu&&r.status==="Pending"}
function fuClass(r){if(!r.fu||r.status!=="Pending")return"";var t=today();if(r.fu<t)return"due";var d=(new Date(r.fu)-new Date(t))/864e5;return d<=3?"soon":""}
function render(){
  var q=$("q").value.toLowerCase(),ft=$("ft").value,fs=$("fs").value;
  var list=recs.filter(function(r){return(!fuOnly||isFu(r))&&(!ft||r.type===ft)&&(!fs||r.status===fs)&&(!q||(r.name+" "+r.contact+" "+r.remarks).toLowerCase().indexOf(q)>-1)});
  list.sort(function(a,b){return fuOnly?a.fu.localeCompare(b.fu):b.date.localeCompare(a.date)});
  var tot=0,pend=0,due=0,fu=0;recs.forEach(function(r){tot+=Number(r.amount)||0;if(isFu(r))fu++;if(r.status==="Pending")pend++;if(fuClass(r)==="due")due++});
  $("sTot").textContent=peso(tot);$("sCnt").textContent=recs.length;$("sPend").textContent=pend;$("sDue").textContent=due;$("sFu").textContent=fu;
  $("fuBtn").textContent=fuOnly?"Show all records":"Show follow-ups only";
  $("fuBtn").className=fuOnly?"p":"";$("fuCard").style.outline=fuOnly?"2px solid var(--ac)":"none";
  $("empty").textContent=fuOnly?"No follow-ups right now.":"No records yet. Add your first solicitation above.";
  $("empty").classList.toggle("hide",list.length>0);
  $("tb").innerHTML=list.map(function(r){
    return '<tr data-id="'+r.id+'"><td>'+esc(r.date)+'</td><td><b>'+esc(r.name)+'</b><br><span style="color:var(--mu)">'+esc(r.contact)+'</span></td><td>'+esc(r.type)+'</td><td>'+esc(r.remarks)+'</td>'+
    '<td><input type="number" min="0" step="0.01" class="ea" value="'+(r.amount||"")+'" placeholder="0.00"></td>'+
    '<td><input type="date" class="ef '+fuClass(r)+'" value="'+esc(r.fu)+'"></td>'+
    '<td><select class="es"><option'+(r.status==="Pending"?" selected":"")+'>Pending</option><option'+(r.status==="Given"?" selected":"")+'>Given</option><option'+(r.status==="Declined"?" selected":"")+'>Declined</option></select></td>'+
    '<td style="white-space:nowrap"><button class="be">Edit</button> <button class="bd d">Delete</button></td></tr>';
  }).join("");
}
$("tb").addEventListener("change",function(e){
  var tr=e.target.closest("tr");if(!tr)return;var r=recs.find(function(x){return x.id===tr.dataset.id});if(!r)return;
  var n=Object.assign({},r);
  if(e.target.classList.contains("ea"))n.amount=parseFloat(e.target.value)||0;
  else if(e.target.classList.contains("ef"))n.fu=e.target.value;
  else if(e.target.classList.contains("es"))n.status=e.target.value;
  put(n);
});
$("tb").addEventListener("click",function(e){
  var tr=e.target.closest("tr");if(!tr)return;var id=tr.dataset.id;
  if(e.target.classList.contains("be"))edit(id);
  if(e.target.classList.contains("bd")&&confirm("Delete this record?"))remove(id);
});
function toggleFu(){fuOnly=!fuOnly;render()}
$("fuBtn").onclick=toggleFu;$("fuCard").onclick=toggleFu;
["q","ft","fs"].forEach(function(i){$(i).oninput=render});

$("csv").onclick=function(){
  var rows=[["Date","Name","Type","Contact","Remarks","Amount Given (PHP)","Follow-up","Status"]];
  recs.forEach(function(r){rows.push([r.date,r.name,r.type,r.contact,r.remarks,r.amount,r.fu,r.status])});
  var t=rows.map(function(r){return r.map(function(c){return '"'+String(c==null?"":c).replace(/"/g,'""')+'"'}).join(",")}).join("\n");
  var a=document.createElement("a");a.href="data:text/csv;charset=utf-8,\ufeff"+encodeURIComponent(t);a.download="solicit-track.csv";a.click();
};

clearForm();render();
})();
