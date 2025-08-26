
// Dinamita POS - v2 (browser)
const STORAGE_KEY = 'dinamita_pos';
const LEGACY_KEYS = ['dinamita_pos_v1', 'dinamita_pos_v1_light'];
const SCHEMA_VERSION = 5;

const DB = {
  load(){
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw){
      try{
        const data = JSON.parse(raw);
        if (!data.schemaVersion || data.schemaVersion < SCHEMA_VERSION) return this.migrate(data);
        return data;
      }catch(e){}
    }
    for (const k of LEGACY_KEYS){
      const legacy = localStorage.getItem(k);
      if (legacy){
        try{
          const data = JSON.parse(legacy);
          const migrated = this.migrate(data);
          this.save(migrated);
          return migrated;
        }catch(e){}
      }
    }
    const seeded = this.seed();
    this.save(seeded);
    return seeded;
  },
  save(data){ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); },
  seed(){
    const today = new Date().toISOString().slice(0,10);
    return {
      schemaVersion: SCHEMA_VERSION,
      settings: { iva: 16, mensaje: 'Gracias por tu compra en Dinamita Gym 💥', logo: DEFAULT_LOGO },
      products: [
        { sku:'WHEY-CH-900', nombre:'Proteína Whey Chocolate 900g', categoria:'Suplementos', precio:499, costo:300, stock:12, img:'', descr:'Whey sabor chocolate.' },
        { sku:'SHAKER-700', nombre:'Shaker Dinamita 700ml', categoria:'Accesorios', precio:149, costo:80, stock:25, img:'', descr:'Shaker resistente.' },
        { sku:'CAFE-LATTE', nombre:'Latte 355ml', categoria:'Cafetería', precio:45, costo:20, stock:50, img:'', descr:'Café latte caliente.' },
        { sku:'TERM-1L', nombre:'Termo 1L Dinamita', categoria:'Accesorios', precio:299, costo:160, stock:8, img:'', descr:'Termo acero.' }
      ],
      customers: [
        { id:'C1', nombre:'Público General', tel:'', email:'', certificadoMedico:false, entrenaSolo:false },
        { id:'C2', nombre:'Familia Dinamita', tel:'', email:'', certificadoMedico:true, entrenaSolo:true }
      ],
      memberships: [
        { id:'M1', cliente:'C2', tipo:'Mensualidad', inicio: today, fin: addDays(today,30), notas:'VIP' }
      ],
      sales: []
    };
  },
  migrate(data){
    data = data || {};
    data.schemaVersion = SCHEMA_VERSION;
    data.settings = data.settings || { iva:16, mensaje:'Gracias por tu compra en Dinamita Gym 💥', logo: DEFAULT_LOGO };
    data.products = data.products || [];
    data.customers = data.customers || [];
    data.memberships = data.memberships || [];
    data.sales = data.sales || [];

    data.products.forEach(p=>{
      if (p.precio === undefined) p.precio = 0;
      if (p.costo  === undefined) p.costo  = 0;
      if (p.stock  === undefined) p.stock  = 0;
      if (p.categoria === undefined) p.categoria = 'General';
      if (p.img === undefined) p.img = '';
      if (p.descr === undefined) p.descr = '';
    });
    data.customers.forEach(c=>{
      if (c.certificadoMedico === undefined) c.certificadoMedico = false;
      if (c.entrenaSolo === undefined) c.entrenaSolo = false;
    });
    data.sales.forEach(s=>{
      if (s.subtotalCosto === undefined){
        const subtotalCosto = (s.items||[]).reduce((a,i)=> a + ((i.costo||0) * (i.qty||0)), 0);
        s.subtotalCosto = subtotalCosto;
      }
      if (s.ganancia === undefined){
        s.ganancia = ((s.total||0) - (s.iva||0)) - (s.subtotalCosto||0);
      }
    });
    return data;
  }
};

function addDays(start, n){ const dt = new Date(start); dt.setDate(dt.getDate()+n); return dt.toISOString().slice(0,10); }

let state = DB.load();

const UI = {
  init(){
    document.querySelectorAll('.menu button').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        document.querySelectorAll('.menu button').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active'); UI.showView(btn.dataset.view);
        document.getElementById('viewTitle').textContent = btn.textContent;
      });
    });
    document.getElementById('collapseBtn').onclick = ()=> document.querySelector('.sidebar').classList.toggle('open');
    document.getElementById('hamburger').onclick = ()=> document.querySelector('.sidebar').classList.toggle('open');
    document.getElementById('backupBtn').onclick = Backup.export;
    document.getElementById('restoreBtn').onclick = ()=> document.getElementById('restoreInput').click();
    document.getElementById('restoreInput').addEventListener('change', Backup.importFile);

    Ventas.fillClientes();
    Membresias.fillClientes();

    Dashboard.render(); Inventario.renderTabla(); Clientes.renderTabla();
    Membresias.renderTabla(); Cafeteria.render(); Historial.renderTabla();
    Config.renderLogo();

    UI.showView('dashboard');
  },
  goto(view){ document.querySelector(`.menu button[data-view="${view}"]`).click(); },
  showView(id){ document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden')); document.getElementById('view-'+id).classList.remove('hidden'); }
};

const Backup = {
  export(){
    const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'dinamita-pos-respaldo.json'; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
  },
  importFile(ev){
    const f = ev.target.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = e=>{
      try{
        let data = JSON.parse(e.target.result);
        if (!data.schemaVersion || data.schemaVersion < SCHEMA_VERSION) data = DB.migrate(data);
        state = data; DB.save(state); UI.init(); alert('Respaldo importado con éxito.');
      }catch(err){ alert('Archivo inválido.'); }
    };
    r.readAsText(f); ev.target.value='';
  }
};

const Dashboard = {
  render(){
    const today = new Date().toISOString().slice(0,10);
    const ventasHoy = state.sales.filter(s=>s.fecha.slice(0,10)===today);
    const totalHoy = ventasHoy.reduce((a,s)=>a+s.total,0);
    const utilidadHoy = ventasHoy.reduce((a,s)=> a + (s.ganancia || ((s.total - s.iva) - (s.subtotalCosto||0))), 0);
    document.getElementById('kpiVentasHoy').textContent = money(totalHoy);
    document.getElementById('kpiTickets').textContent = String(ventasHoy.length);
    const stock = state.products.reduce((a,p)=>a+(p.stock||0),0);
    document.getElementById('kpiStock').textContent = String(stock);
    document.getElementById('kpiGananciaHoy').textContent = money(utilidadHoy);
  }
};

const Ventas = {
  carrito: [],
  buscarProducto(term){
    term = (term||'').toLowerCase();
    const res = state.products.filter(p=> p.nombre.toLowerCase().includes(term) || (p.sku||'').toLowerCase().includes(term));
    const wrap = document.getElementById('ventaResultados'); wrap.innerHTML='';
    res.forEach(p=>{
      const div = document.createElement('div'); div.className='list-item';
      div.innerHTML = `<div style="flex:1">
        <div><strong>${esc(p.nombre)}</strong> <small>(${esc(p.sku)})</small></div>
        <div class="sub">Precio: ${money(p.precio)} • Stock: ${p.stock}</div>
      </div>
      <div class="qty-wrap">
        <input type="number" min="1" step="1" value="1">
        <button class="btn small">➕ Agregar</button>
      </div>`;
      div.querySelector('button').onclick = ()=>{
        const qty = parseInt(div.querySelector('input').value||'1',10);
        Ventas.addCarrito(p.sku, qty);
      };
      wrap.appendChild(div);
    });
  },
  addCarrito(sku, qty){
    const p = state.products.find(x=>x.sku===sku); if(!p) return;
    const exist = Ventas.carrito.find(x=>x.sku===sku);
    if (exist) exist.qty += qty; else Ventas.carrito.push({ sku, nombre:p.nombre, precio:p.precio, qty });
    Ventas.renderCarrito();
  },
  renderCarrito(){
    const cont = document.getElementById('carrito'); cont.innerHTML='';
    Ventas.carrito.forEach(item=>{
      const div = document.createElement('div'); div.className='list-item';
      div.innerHTML = `<div style="flex:1">
        <div><strong>${esc(item.nombre)}</strong></div>
        <div class="sub">Precio: ${money(item.precio)} x ${item.qty}</div>
      </div>
      <div class="qty-wrap">
        <button class="btn small" title="Quitar" onclick="Ventas.delItem('${item.sku}')">✕</button>
      </div>`;
      cont.appendChild(div);
    });
    Ventas.updateTotals();
    Ventas.fillClientes();
  },
  updateTotals(){
    const subtotal = Ventas.carrito.reduce((a,i)=>a+i.precio*i.qty,0);
    const ivaPct = state.settings.iva || 0;
    const iva = subtotal*(ivaPct/100);
    const total = subtotal + iva;
    document.getElementById('ventaSubtotal').textContent = money(subtotal);
    document.getElementById('ventaIVA').textContent = money(iva);
    document.getElementById('ventaTotal').textContent = money(total);
    return {subtotal, iva, total};
  },
  delItem(sku){ Ventas.carrito = Ventas.carrito.filter(i=>i.sku!==sku); Ventas.renderCarrito(); },
  fillClientes(){
    const sel = document.getElementById('ventaCliente'); sel.innerHTML='';
    state.customers.forEach(c=>{ const opt=document.createElement('option'); opt.value=c.id; opt.textContent=c.nombre; sel.appendChild(opt); });
  },
  confirmar(){
    if (Ventas.carrito.length===0){ alert('Agrega productos al carrito.'); return; }
    for (const it of Ventas.carrito){
      const p = state.products.find(x=>x.sku===it.sku);
      if (!p || p.stock < it.qty){ alert('Stock insuficiente para: '+it.nombre); return; }
    }
    // descuenta stock
    Ventas.carrito.forEach(it=>{ const p=state.products.find(x=>x.sku===it.sku); p.stock -= it.qty; });
    const cliente = document.getElementById('ventaCliente').value;
    const notas = document.getElementById('ventaNotas').value || '';
    const totals = Ventas.updateTotals();
    const folio = 'T'+Date.now().toString().slice(-8);
    const items = Ventas.carrito.map(it=>{
      const prod = state.products.find(x=>x.sku===it.sku);
      return { sku:it.sku, nombre:it.nombre, precio:it.precio, costo: prod?.costo||0, qty:it.qty };
    });
    const venta = {
      folio, fecha:new Date().toISOString(), items,
      subtotal: totals.subtotal, iva: totals.iva, total: totals.total,
      cliente, notas
    };
    venta.subtotalCosto = items.reduce((a,i)=>a+i.costo*i.qty,0);
    venta.ganancia = (venta.total - venta.iva) - venta.subtotalCosto;

    state.sales.unshift(venta);
    DB.save(state);

    Ventas.carrito = []; Ventas.renderCarrito();
    Dashboard.render(); Inventario.renderTabla(); Historial.renderTabla();
    Tickets.render(venta); UI.goto('ticket');
  }
};

const Inventario = {
  imgData:'',
  limpiar(){ ['prodSku','prodNombre','prodCategoria','prodPrecio','prodCosto','prodStock','prodDescr'].forEach(id=>document.getElementById(id).value=''); document.getElementById('prodImg').value=''; this.imgData=''; },
  loadImage(input){ const f=input.files[0]; if(!f) return; const r=new FileReader(); r.onload=e=>{ this.imgData=e.target.result; }; r.readAsDataURL(f); },
  guardar(){
    const sku = document.getElementById('prodSku').value.trim();
    const nombre = document.getElementById('prodNombre').value.trim();
    if(!sku || !nombre){ alert('SKU y Nombre son obligatorios.'); return; }
    const categoria = document.getElementById('prodCategoria').value.trim() || 'General';
    const precio = parseFloat(document.getElementById('prodPrecio').value||'0');
    const costo  = parseFloat(document.getElementById('prodCosto').value||'0');
    const stock = parseInt(document.getElementById('prodStock').value||'0',10);
    const descr = document.getElementById('prodDescr').value.trim();
    let p = state.products.find(x=>x.sku===sku);
    if (p){ p.nombre=nombre; p.categoria=categoria; p.precio=precio; p.costo=costo; p.stock=stock; p.descr=descr; if(this.imgData) p.img=this.imgData; }
    else { p={ sku, nombre, categoria, precio, costo, stock, img:this.imgData||'', descr }; state.products.unshift(p); }
    DB.save(state); this.renderTabla(); alert('Producto guardado.');
  },
  renderTabla(){
    const q = (document.getElementById('invSearch').value||'').toLowerCase();
    const cat = (document.getElementById('invCat').value||'').toLowerCase();
    const rows = state.products.filter(p=>{
      const okQ = p.nombre.toLowerCase().includes(q) || (p.sku||'').toLowerCase().includes(q);
      const okC = !cat || (p.categoria||'').toLowerCase()===cat;
      return okQ && okC;
    }).map(p=>{
      const stockBadge = p.stock>5 ? '<span class="badge ok">✅ OK</span>' : p.stock>0 ? '<span class="badge warn">⚠️ Bajo</span>' : '<span class="badge bad">⛔ Agotado</span>';
      return `<tr>
        <td>${esc(p.sku)}</td><td>${esc(p.nombre)}</td><td>${esc(p.categoria||'')}</td>
        <td>${money(p.precio)}</td><td>${money(p.costo||0)}</td>
        <td>${p.stock} ${stockBadge}</td>
        <td><button class="btn small" onclick="Inventario.edit('${p.sku}')">✏️ Editar</button>
            <button class="btn danger small" onclick="Inventario.del('${p.sku}')">🗑️ Borrar</button></td>
      </tr>`;
    }).join('');
    document.getElementById('invTabla').innerHTML = `<table>
      <thead><tr><th>SKU</th><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Costo</th><th>Stock</th><th></th></tr></thead>
      <tbody>${rows || '<tr><td colspan="7">Sin productos</td></tr>'}</tbody></table>`;
  },
  edit(sku){
    const p = state.products.find(x=>x.sku===sku); if(!p) return;
    document.getElementById('prodSku').value=p.sku;
    document.getElementById('prodNombre').value=p.nombre;
    document.getElementById('prodCategoria').value=p.categoria||'';
    document.getElementById('prodPrecio').value=p.precio;
    document.getElementById('prodCosto').value=p.costo||0;
    document.getElementById('prodStock').value=p.stock;
    document.getElementById('prodDescr').value=p.descr||'';
    window.scrollTo({top:0,behavior:'smooth'});
  },
  del(sku){
    if(!confirm('¿Eliminar producto?')) return;
    state.products = state.products.filter(x=>x.sku!==sku);
    DB.save(state); this.renderTabla();
  },
  exportCSV(){
    const rows = [['SKU','Nombre','Categoría','Precio','Costo','Stock']]
      .concat(state.products.map(p=>[p.sku,p.nombre,p.categoria||'',p.precio,(p.costo||0),p.stock]));
    downloadCSV('inventario.csv', rows);
  }
};

const Clientes = {
  limpiar(){
    ['cliId','cliNombre','cliTel','cliEmail'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('cliCertMed').checked=false; document.getElementById('cliEntrenaSolo').checked=false;
  },
  guardar(){
    const idEdit = (document.getElementById('cliId').value||'').trim();
    const nombre = document.getElementById('cliNombre').value.trim();
    if(!nombre){ alert('Nombre es obligatorio.'); return; }
    const tel = document.getElementById('cliTel').value.trim();
    const email = document.getElementById('cliEmail').value.trim();
    const certificadoMedico = document.getElementById('cliCertMed').checked;
    const entrenaSolo = document.getElementById('cliEntrenaSolo').checked;
    let c;
    if (idEdit){
      c = state.customers.find(x=>x.id===idEdit); if(!c){ alert('Cliente no encontrado'); return; }
      c.nombre=nombre; c.tel=tel; c.email=email; c.certificadoMedico=certificadoMedico; c.entrenaSolo=entrenaSolo;
    }else{
      const id='C'+Date.now().toString(36);
      c = { id, nombre, tel, email, certificadoMedico, entrenaSolo }; state.customers.unshift(c);
    }
    DB.save(state); this.renderTabla(); Ventas.fillClientes(); Membresias.fillClientes && Membresias.fillClientes(); this.limpiar(); alert('Cliente guardado.');
  },
  edit(id){
    const c = state.customers.find(x=>x.id===id); if(!c) return;
    document.getElementById('cliId').value=c.id;
    document.getElementById('cliNombre').value=c.nombre||'';
    document.getElementById('cliTel').value=c.tel||'';
    document.getElementById('cliEmail').value=c.email||'';
    document.getElementById('cliCertMed').checked=!!c.certificadoMedico;
    document.getElementById('cliEntrenaSolo').checked=!!c.entrenaSolo;
    window.scrollTo({top:0,behavior:'smooth'});
  },
  del(id){
    const c = state.customers.find(x=>x.id===id); if(!c) return;
    if(!confirm(`¿Eliminar al cliente "${c.nombre}"?`)) return;
    state.customers = state.customers.filter(x=>x.id!==id);
    DB.save(state); this.renderTabla(); Ventas.fillClientes(); Membresias.fillClientes && Membresias.fillClientes();
  },
  renderTabla(){
    const q = (document.getElementById('cliSearch').value||'').toLowerCase();
    const rows = state.customers.filter(c=> (c.nombre||'').toLowerCase().includes(q) || (c.tel||'').toLowerCase().includes(q) || (c.email||'').toLowerCase().includes(q)).map(c=>{
      const cm = c.certificadoMedico ? '<span class="badge ok">✅ Sí</span>' : '<span class="badge bad">❌ No</span>';
      const es = c.entrenaSolo ? '<span class="badge warn">🏋️‍♂️ Solo</span>' : '<span class="badge ok">👥 Acomp.</span>';
      return `<tr>
        <td>${esc(c.nombre)}</td><td>${esc(c.tel||'')}</td><td>${esc(c.email||'')}</td>
        <td>${cm}</td><td>${es}</td>
        <td><button class="btn small" onclick="Clientes.edit('${c.id}')">✏️ Editar</button>
            <button class="btn danger small" onclick="Clientes.del('${c.id}')">🗑️ Borrar</button></td>
      </tr>`;
    }).join('');
    document.getElementById('cliTabla').innerHTML = `<table>
      <thead><tr><th>Nombre</th><th>Teléfono</th><th>Email</th><th>Cert. médico</th><th>Entrena</th><th></th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6">Sin clientes</td></tr>'}</tbody></table>`;
  },
  exportCSV(){
    const rows = [['ID','Nombre','Telefono','Email','CertificadoMedico','EntrenaSolo']]
      .concat(state.customers.map(c=>[c.id, c.nombre||'', c.tel||'', c.email||'', c.certificadoMedico?'SI':'NO', c.entrenaSolo?'SOLO':'ACOMPAÑADO']));
    downloadCSV('clientes.csv', rows);
  }
};

const Membresias = {
  fillClientes(){
    document.getElementById('memClienteSearch').value='';
    document.getElementById('memClienteId').value='';
    document.getElementById('memClienteResults').innerHTML='';
    document.getElementById('memClienteResults').classList.add('hidden');
    const today = new Date().toISOString().slice(0,10);
    document.getElementById('memInicio').value=today;
    document.getElementById('memFin').value=this.calcFin('Mensualidad', today);
  },
  searchCliente(term){
    const box = document.getElementById('memClienteResults');
    term = (term||'').trim().toLowerCase();
    if(!term){ box.classList.add('hidden'); box.innerHTML=''; return; }
    const res = state.customers.filter(c=> ((c.nombre||'')+' '+(c.tel||'')+' '+(c.email||'')).toLowerCase().includes(term)).slice(0,30);
    box.innerHTML = res.length? res.map(c=>`
      <div class="item" onclick="Membresias.pickCliente('${c.id}')">
        <div><strong>👤 ${esc(c.nombre||'')}</strong></div>
        <div class="muted">📞 ${esc(c.tel||'')} · ✉️ ${esc(c.email||'')}</div>
      </div>`).join('') : `<div class="item"><span class="muted">Sin coincidencias</span></div>`;
    box.classList.remove('hidden');
  },
  pickCliente(id){
    const c = state.customers.find(x=>x.id===id); if(!c) return;
    document.getElementById('memClienteId').value=c.id;
    document.getElementById('memClienteSearch').value=c.nombre||'';
    document.getElementById('memClienteResults').classList.add('hidden');
  },
  changeTipo(){
    const tipo = document.getElementById('memTipo').value;
    const inicio = document.getElementById('memInicio').value || new Date().toISOString().slice(0,10);
    document.getElementById('memFin').value = this.calcFin(tipo, inicio);
  },
  calcFin(tipo, inicio){
    switch(tipo){
      case 'Visita': return inicio;
      case 'Semana': return addDays(inicio,7);
      case 'Mensualidad': return addDays(inicio,30);
      case '6 Meses': return addDays(inicio,182);
      case '12 Meses': return addDays(inicio,365);
      case 'VIP': return addDays(inicio,365*5);
      case 'Promo 2x$500': return addDays(inicio,30);
      default: return inicio;
    }
  },
  guardar(){
    const cliente = document.getElementById('memClienteId').value;
    if(!cliente){ alert('Selecciona un cliente del buscador.'); return; }
    const tipo = document.getElementById('memTipo').value;
    const inicio = document.getElementById('memInicio').value;
    const fin = document.getElementById('memFin').value;
    const notas = document.getElementById('memNotas').value || '';
    const id = 'M'+Date.now().toString(36);
    state.memberships.unshift({ id, cliente, tipo, inicio, fin, notas });
    DB.save(state); this.renderTabla(); Dashboard.render(); alert('Membresía registrada.');
  },
  status(m){
    const today = new Date().toISOString().slice(0,10);
    if(m.fin < today) return 'vencida';
    const days = Math.ceil((new Date(m.fin)-new Date(today))/(1000*60*60*24));
    if(days <= 5) return 'próxima';
    return 'activa';
  },
  renderTabla(){
    const q = (document.getElementById('memSearch').value||'').toLowerCase();
    const st = (document.getElementById('memStatus').value||'').toLowerCase();
    const rows = state.memberships.filter(m=>{
      const cliente = state.customers.find(c=>c.id===m.cliente);
      const name = cliente? (cliente.nombre||'') : '';
      const okQ = name.toLowerCase().includes(q);
      const status = this.status(m);
      const okS = !st || st===status;
      return okQ && okS;
    }).map(m=>{
      const c = state.customers.find(x=>x.id===m.cliente);
      const name = c? c.nombre : m.cliente;
      const status = this.status(m);
      const badge = status==='activa' ? '<span class="badge ok">✅ Activa</span>' :
                    status==='próxima' ? '<span class="badge warn">⏳ Próx. a vencer</span>' :
                    '<span class="badge bad">❌ Vencida</span>';
      return `<tr>
        <td>${esc(name)}</td><td>${esc(m.tipo)}</td><td>${esc(m.inicio)}</td>
        <td>${esc(m.fin)}</td><td>${badge}</td><td>${esc(m.notas||'')}</td>
      </tr>`;
    }).join('');
    document.getElementById('memTabla').innerHTML = `<table>
      <thead><tr><th>Cliente</th><th>Tipo</th><th>Inicio</th><th>Fin</th><th>Estado</th><th>Notas</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6">Sin registros</td></tr>'}</tbody></table>`;
  }
};
document.addEventListener('click', (e)=>{
  const box = document.getElementById('memClienteResults');
  const wrap = document.querySelector('.searchbox');
  if (box && wrap && !wrap.contains(e.target)) box.classList.add('hidden');
});

const Cafeteria = {
  render(){
    const cont = document.getElementById('cafGrid'); cont.innerHTML='';
    const cafeItems = state.products.filter(p=>(p.categoria||'').toLowerCase().includes('cafeter'));
    if (cafeItems.length===0){ cont.innerHTML='<div>No hay productos de cafetería. Agrega en Inventario.</div>'; return; }
    const placeholder = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="100%" height="100%" fill="%23f4f4f4"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23999" font-size="28" font-family="Arial">☕ Sin imagen</text></svg>';
    cafeItems.forEach(p=>{
      const card = document.createElement('div'); card.className='card-prod';
      const img = p.img || placeholder;
      card.innerHTML = `<img src="${img}" onerror="this.src='${placeholder}'" alt="">
        <div class="pbody">
          <div class="pname">☕ ${esc(p.nombre)}</div>
          <div class="pprice">${money(p.precio)}</div>
          <div class="pbtns">
            <button class="btn small" onclick="Ventas.addCarrito('${p.sku}',1)">➕ Agregar</button>
            <button class="btn secondary small" onclick="UI.goto('ventas')">➡️ Ir a cobrar</button>
          </div>
        </div>`;
      cont.appendChild(card);
    });
  }
};

const Historial = {
  openFiltros(){
    const m=document.getElementById('modalFiltros'); m.classList.remove('hidden'); m.setAttribute('aria-hidden','false');
    const esc=(e)=>{ if(e.key==='Escape'){ this.closeFiltros(); document.removeEventListener('keydown',esc);} }; document.addEventListener('keydown',esc);
    m.addEventListener('click', (e)=>{ if(e.target.id==='modalFiltros') this.closeFiltros(); }, { once:true });
  },
  closeFiltros(){ const m=document.getElementById('modalFiltros'); m.classList.add('hidden'); m.setAttribute('aria-hidden','true'); },
  applyFiltros(){ this.renderTabla(); this.closeFiltros(); },
  clearFiltros(){
    ['histFechaIni','histFechaFin','histFolio','histCliente','histProducto'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('histPago').value=''; this.renderTabla();
  },
  renderTabla(){
    const ini = document.getElementById('histFechaIni')?.value || '';
    const fin = document.getElementById('histFechaFin')?.value || '';
    const folio = (document.getElementById('histFolio')?.value||'').toLowerCase();
    const clienteQ = (document.getElementById('histCliente')?.value||'').toLowerCase();
    const prodQ = (document.getElementById('histProducto')?.value||'').toLowerCase();
    const pagoQ = document.getElementById('histPago')?.value || '';

    const rows = state.sales.filter(s=>{
      const fecha = s.fecha.slice(0,10);
      if (ini && fecha < ini) return false;
      if (fin && fecha > fin) return false;
      if (folio && !s.folio.toLowerCase().includes(folio)) return false;
      const cliente = getClienteNombre(s.cliente)||'';
      if (clienteQ && !cliente.toLowerCase().includes(clienteQ)) return false;
      if (prodQ){
        const items = s.items.map(i=>i.nombre).join(' ').toLowerCase();
        if (!items.includes(prodQ)) return false;
      }
      // pagoQ reservado para futuro
      return true;
    }).map(s=>{
      const cliente = getClienteNombre(s.cliente)||'';
      const itemsStr = s.items.map(i=>`${i.nombre} x${i.qty}`).join(', ');
      return `<tr>
        <td>${esc(s.folio)}</td>
        <td>${s.fecha.slice(0,16).replace('T',' ')}</td>
        <td>${esc(cliente)}</td>
        <td>${esc(itemsStr)}</td>
        <td>${money(s.total)}</td>
        <td><button class="btn small" onclick="Tickets.renderByFolio('${s.folio}')">🖨️ Reimprimir</button></td>
      </tr>`;
    }).join('');

    document.getElementById('histTabla').innerHTML = `<table>
      <thead><tr><th>Folio</th><th>Fecha</th><th>Cliente</th><th>Items</th><th>Total</th><th></th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6">Sin ventas</td></tr>'}</tbody></table>`;
  },
  exportCSV(){
    const rows = [['Folio','Fecha','Cliente','Items','Total','IVA','Costo','Ganancia']].concat(
      state.sales.map(s=>[ s.folio, s.fecha, getClienteNombre(s.cliente)||'',
        s.items.map(i=>`${i.nombre} x${i.qty}`).join('; '),
        s.total, s.iva, (s.subtotalCosto||0), (s.ganancia||((s.total - s.iva) - (s.subtotalCosto||0))) ])
    );
    downloadCSV('historial_ventas.csv', rows);
  }
};

const Config = {
  guardar(){
    const iva = parseFloat(document.getElementById('cfgIVA').value||'16');
    const mensaje = document.getElementById('cfgMensaje').value || 'Gracias por tu compra en Dinamita Gym 💥';
    state.settings.iva = isNaN(iva)?16:iva; state.settings.mensaje = mensaje; DB.save(state);
    alert('Configuración guardada.');
  },
  reset(){
    state.settings.iva=16; state.settings.mensaje='Gracias por tu compra en Dinamita Gym 💥'; state.settings.logo=DEFAULT_LOGO;
    DB.save(state); this.renderLogo(); alert('Configuración restablecida.');
  },
  loadLogo(input){
    const file=input.files[0]; if(!file) return;
    const reader=new FileReader(); reader.onload=e=>{ state.settings.logo=e.target.result; DB.save(state); this.renderLogo(); };
    reader.readAsDataURL(file);
  },
  renderLogo(){
    document.getElementById('brandLogo').src = state.settings.logo || DEFAULT_LOGO;
    document.getElementById('ticketLogo').src = state.settings.logo || DEFAULT_LOGO;
    const ivaEl = document.getElementById('cfgIVA'); if(ivaEl) ivaEl.value = state.settings.iva||16;
    const msgEl = document.getElementById('cfgMensaje'); if(msgEl) msgEl.value = state.settings.mensaje||'';
  }
};

const Tickets = {
  render(venta){
    const body = document.getElementById('ticketBody'); body.innerHTML='';
    const lines = [];
    lines.push(center('🧾 DINAMITA GYM'));
    lines.push('Folio: '+venta.folio);
    lines.push('Fecha: '+venta.fecha.replace('T',' ').slice(0,16));
    lines.push('Cliente: '+(getClienteNombre(venta.cliente)||''));
    lines.push(repeat('-',32));
    venta.items.forEach(i=>{
      const name = truncate(i.nombre, 18);
      const qty = ('x'+i.qty).padEnd(4,' ');
      const price = money(i.precio);
      lines.push(padRight(name, 22) + padLeft(qty+price, 10));
    });
    lines.push(repeat('-',32));
    lines.push(padRight('SUBTOTAL',20) + padLeft(money(venta.subtotal),12));
    lines.push(padRight('IVA',20) + padLeft(money(venta.iva),12));
    lines.push(padRight('TOTAL',20) + padLeft(money(venta.total),12));
    lines.push(repeat('-',32));
    const notaFinal = (venta.notas && venta.notas.trim()) ? venta.notas.trim() : (state.settings.mensaje || '');
    if (notaFinal) lines.push(notaFinal);
    body.innerHTML = '<pre>'+lines.join('\\n')+'</pre>';
    document.getElementById('ticketMsg').textContent = notaFinal;
  },
  renderByFolio(folio){ const v = state.sales.find(s=>s.folio===folio); if(!v){ alert('Venta no encontrada'); return; } this.render(v); UI.goto('ticket'); },
  print(){ window.print(); }
};

function getClienteNombre(id){ const c = state.customers.find(x=>x.id===id); return c? c.nombre : ''; }
function esc(x){ return (x||'').replace(/[&<>"]/g, s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s])); }
function money(n){ return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(n||0); }
function repeat(ch,n){ return new Array(n+1).join(ch); }
function center(t){ const w=32; const p=Math.max(0,Math.floor((w-t.length)/2)); return ' '.repeat(p)+t; }
function padRight(t,n){ return (t+' '.repeat(n)).slice(0,n); }
function padLeft(t,n){ return (' '.repeat(n)+t).slice(-n); }
function truncate(s,n){ return s.length>n? s.slice(0,n-1)+'…' : s; }
function downloadCSV(filename, rows){
  const csv = rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1500);
}

window.addEventListener('DOMContentLoaded', UI.init);
