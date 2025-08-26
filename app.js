
const UI = {
  show(id){
    document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden'));
    document.getElementById('view-'+id).classList.remove('hidden');
  }
};

const Tickets = {
  demo(){
    const now = new Date().toISOString().replace('T',' ').slice(0,16);
    const items=[['Proteína Whey',1,499],['Shaker Dinamita',2,149]];
    let subtotal=0; items.forEach(i=>subtotal+=i[1]*i[2]);
    let iva=subtotal*0.16,total=subtotal+iva;
    const lines=[];
    lines.push(center('🧾 DINAMITA GYM'));
    lines.push('Folio: T'+Date.now().toString().slice(-8));
    lines.push('Fecha: '+now);
    lines.push('Cliente: Público General');
    lines.push(repeat('-',32));
    for(const [n,q,p] of items){
      const right=`x${q} ${money(p)}`;
      lines.push(padRight(n,22)+padLeft(right,10));
    }
    lines.push(repeat('-',32));
    lines.push(padRight('SUBTOTAL',20)+padLeft(money(subtotal),12));
    lines.push(padRight('IVA',20)+padLeft(money(iva),12));
    lines.push(padRight('TOTAL',20)+padLeft(money(total),12));
    lines.push(repeat('-',32));
    lines.push('Gracias por tu compra en Dinamita Gym 💥');
    document.getElementById('ticketBody').textContent=lines.join('\n');
    UI.show('ticket');
  },
  print(){window.print();}
};

function money(n){return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(n||0);}
function repeat(ch,n){return new Array(n+1).join(ch);}
function padRight(t,n){return (t+' '.repeat(n)).slice(0,n);}
function padLeft(t,n){return (' '.repeat(n)+t).slice(-n);}
function center(t){const w=32;const p=Math.max(0,Math.floor((w-t.length)/2));return ' '.repeat(p)+t;}
