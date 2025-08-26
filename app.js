
document.addEventListener('DOMContentLoaded', ()=>{
  document.querySelectorAll('.menu button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.menu button').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden'));
      document.getElementById('view-'+btn.dataset.view).classList.remove('hidden');
      document.getElementById('viewTitle').textContent = btn.textContent;
    });
  });
});
