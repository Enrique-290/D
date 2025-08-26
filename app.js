
// Dinamita POS - localStorage DB (Light Theme Variant)
const DB = {
  key: 'dinamita_pos_v1_light',
  load(){
    const raw = localStorage.getItem(this.key);
    if(!raw){
      const data = this.seed();
      localStorage.setItem(this.key, JSON.stringify(data));
      return data;
    }
    try{
      return JSON.parse(raw);
    }catch(e){
      alert('Error leyendo datos locales. Se reiniciará.');
      const data = this.seed();
      localStorage.setItem(this.key, JSON.stringify(data));
      return data;
    }
  },
  save(data){ localStorage.setItem(this.key, JSON.stringify(data)); },
  seed(){
    const now = new Date();
    const today = now.toISOString().slice(0,10);
    return {
      settings: { iva: 16, mensaje: 'Gracias por tu compra en Dinamita Gym 💥', logo: DEFAULT_LOGO },
      products: [
        { sku:'WHEY-CH-900', nombre:'Proteína Whey Chocolate 900g', categoria:'Suplementos', precio:499, stock:12, img:'', descr:'Whey sabor chocolate.' },
        { sku:'SHAKER-700', nombre:'Shaker Dinamita 700ml', categoria:'Accesorios', precio:149, stock:25, img:'', descr:'Shaker resistente.' },
        { sku:'CAFE-LATTE', nombre:'Latte 355ml', categoria:'Cafetería', precio:45, stock:50, img:'', descr:'Café latte caliente.' },
        { sku:'TERM-1L', nombre:'Termo 1L Dinamita', categoria:'Accesorios', precio:299, stock:8, img:'', descr:'Termo acero.' },
      ],
      customers: [
        { id: 'C1', nombre:'Público General', tel:'', email:'' },
        { id: 'C2', nombre:'Familia Dinamita', tel:'', email:'' }
      ],
      memberships: [
        { id:'M1', cliente:'C2', tipo:'Mensualidad', inicio: today, fin: addDays(today, 30), notas:'VIP' }
      ],
      sales: []
    };
  }
};

function addDays(start, n){
  const dt = new Date(start); dt.setDate(dt.getDate()+n);
  return dt.toISOString().slice(0,10);
}

let state = DB.load();

const UI = {
  init(){
    document.querySelectorAll('.menu button').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        document.querySelectorAll('.menu button').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        UI.showView(btn.dataset.view);
        document.getElementById('viewTitle').textContent = btn.textContent;
      });
    });
    document.getElementById('collapseBtn').onclick = ()=>{
      document.querySelector('.sidebar').classList.toggle('open');
    };
    document.getElementById('hamburger').onclick = ()=>{
      document.querySelector('.sidebar').classList.toggle('open');
    };
    document.getElementById('backupBtn').onclick = Backup.export;
    document.getElementById('restoreBtn').onclick = ()=> document.getElementById('restoreInput').click();
    document.getElementById('restoreInput').addEventListener('change', Backup.importFile);

    Ventas.fillClientes();
    Membresias.fillClientes();

    Dashboard.render();
    Inventario.renderTabla();
    Clientes.renderTabla();
    Membresias.renderTabla();
    Cafeteria.render();
    Historial.renderTabla();
    Config.renderLogo();

    UI.showView('dashboard');
  },
  goto(view){ document.querySelector(`.menu button[data-view="${view}"]`).click(); },
  showView(id){
    document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden'));
    document.getElementById('view-'+id).classList.remove('hidden');
  }
};

const Backup = {
  export(){
    const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'dinamita-pos-respaldo.json';
    a.click();
    URL.revokeObjectURL(url);
  },
  importFile(ev){
    const file = ev.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = e=>{
      try{
        const data = JSON.parse(e.target.result);
        state = data;
        DB.save(state);
        UI.init();
        alert('Respaldo importado con éxito.');
      }catch(err){
        alert('Archivo inválido.');
      }
    };
    reader.readAsText(file);
    ev.target.value = '';
  }
};

const Dashboard = {
  render(){
    const today = new Date().toISOString().slice(0,10);
    const ventasHoy = state.sales.filter(s=>s.fecha.startsWith(today));
    const totalHoy = ventasHoy.reduce((a,s)=>a+s.total,0);
    document.getElementById('kpiVentasHoy').textContent = money(totalHoy);
    document.getElementById('kpiTickets').textContent = ventasHoy.length.toString();

    const stock = state.products.reduce((a,p)=>a+(p.stock||0),0);
    document.getElementById('kpiStock').textContent = stock.toString();

    const act = state.memberships.filter(m=>Membresias.status(m)==='activa').length;
    document.getElementById('kpiMembresias').textContent = act.toString();
  }
};

const Ventas = {
  carrito: [],
  buscarProducto(term){
    term = (term||'').toLowerCase();
    const res = state.products.filter(p=> p.nombre.toLowerCase().includes(term) || (p.sku||'').toLowerCase().includes(term));
    const wrap = document.getElementById('ventaResultados');
    wrap.innerHTML = '';
    res.forEach(p=>{
      const div = document.createElement('div');
      div.className = 'list-item';
      div.innerHTML = `<div style="flex:1">
          <div><strong>${esc(p.nombre)}</strong> <small>(${esc(p.sku)})</small></div>
          <div class="sub">Precio: ${money(p.precio)} • Stock: ${p.stock}</div>
        </div>
        <div class="qty-wrap">
          <input type="number" min="1" step="1" value="1">
          <button class="btn small">Agregar</button>
        </div>`;
      div.querySelector('button').onclick = ()=>{
        const qty = parseInt(div.querySelector('input').value||'1',10);
        Ventas.addCarrito(p.sku, qty);
      };
      wrap.appendChild(div);
    });
  },
  addCarrito(sku, qty){
    const p = state.products.find(x=>x.sku===sku);
    if(!p) return;
    const exist = Ventas.carrito.find(x=>x.sku===sku);
    if(exist){ exist.qty += qty; } else { Ventas.carrito.push({ sku, nombre:p.nombre, precio:p.precio, qty }); }
    Ventas.renderCarrito();
  },
  renderCarrito(){
    const cont = document.getElementById('carrito');
    cont.innerHTML = '';
    Ventas.carrito.forEach(item=>{
      const div = document.createElement('div');
      div.className = 'list-item';
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
    const iva = subtotal * (ivaPct/100);
    const total = subtotal + iva;
    document.getElementById('ventaSubtotal').textContent = money(subtotal);
    document.getElementById('ventaIVA').textContent = money(iva);
    document.getElementById('ventaTotal').textContent = money(total);
    return {subtotal, iva, total};
  },
  delItem(sku){
    Ventas.carrito = Ventas.carrito.filter(i=>i.sku!==sku);
    Ventas.renderCarrito();
  },
  addPago(){
    const wrap = document.getElementById('pagosWrap');
    const row = document.createElement('div');
    row.className = 'pago-row';
    row.innerHTML = `<select class="pago-metodo">
        <option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option><option>Mixto</option>
      </select>
      <input class="pago-monto" type="number" min="0" step="0.01" placeholder="Monto">
      <button class="btn danger small" onclick="Ventas.removePago(this)">✕</button>`;
    wrap.appendChild(row);
  },
  removePago(btn){
    btn.closest('.pago-row').remove();
  },
  fillClientes(){
    const sel = document.getElementById('ventaCliente');
    sel.innerHTML = '';
    state.customers.forEach(c=>{
      const opt = document.createElement('option');
      opt.value = c.id; opt.textContent = c.nombre;
      sel.appendChild(opt);
    });
  },
  confirmar(){
    if(Ventas.carrito.length===0){ alert('Agrega productos al carrito.'); return; }
    for(const it of Ventas.carrito){
      const p = state.products.find(x=>x.sku===it.sku);
      if(!p || p.stock < it.qty){
        alert('Stock insuficiente para: '+it.nombre);
        return;
      }
    }
    const pagos = Array.from(document.querySelectorAll('#pagosWrap .pago-row')).map(row=>{
      const met = row.querySelector('.pago-metodo').value;
      const mon = parseFloat(row.querySelector('.pago-monto').value||'0');
      return {metodo:met, monto:isNaN(mon)?0:mon};
    }).filter(p=>p.monto>0);
    const {total} = Ventas.updateTotals();
    const sumPagos = pagos.reduce((a,p)=>a+p.monto,0);
    if(pagos.length===0 || Math.abs(sumPagos-total)>0.01){
      if(!confirm('Los pagos no suman exactamente el total. ¿Continuar de todos modos?')) return;
    }
    Ventas.carrito.forEach(it=>{
      const p = state.products.find(x=>x.sku===it.sku);
      p.stock -= it.qty;
    });
    const cliente = document.getElementById('ventaCliente').value;
    const notas = document.getElementById('ventaNotas').value || state.settings.mensaje || '';
    const folio = 'T'+Date.now().toString().slice(-8);
    const venta = {
      folio, fecha: new Date().toISOString(),
      items: JSON.parse(JSON.stringify(Ventas.carrito)),
      subtotal: parseFloat(document.getElementById('ventaSubtotal').textContent.replace(/[^0-9.]/g,'')) || 0,
      iva: parseFloat(document.getElementById('ventaIVA').textContent.replace(/[^0-9.]/g,'')) || 0,
      total, cliente, pagos, notas
    };
    state.sales.unshift(venta);
    DB.save(state);
    Ventas.carrito = [];
    Ventas.renderCarrito();
    Dashboard.render();
    Inventario.renderTabla();
    Historial.renderTabla();
    Tickets.render(venta);
    UI.goto('ticket');
  }
};

const Inventario = {
  imgData: '',
  limpiar(){
    ['prodSku','prodNombre','prodCategoria','prodPrecio','prodStock','prodDescr'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('prodImg').value='';
    Inventario.imgData='';
  },
  loadImage(input){
    const file = input.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = e=>{ Inventario.imgData = e.target.result; };
    reader.readAsDataURL(file);
  },
  guardar(){
    const sku = document.getElementById('prodSku').value.trim();
    const nombre = document.getElementById('prodNombre').value.trim();
    if(!sku || !nombre){ alert('SKU y Nombre son obligatorios.'); return; }
    const categoria = document.getElementById('prodCategoria').value.trim() || 'General';
    const precio = parseFloat(document.getElementById('prodPrecio').value||'0');
    const stock = parseInt(document.getElementById('prodStock').value||'0',10);
    const descr = document.getElementById('prodDescr').value.trim();
    let p = state.products.find(x=>x.sku===sku);
    if(p){
      p.nombre=nombre; p.categoria=categoria; p.precio=precio; p.stock=stock; p.descr=descr;
      if(Inventario.imgData) p.img=Inventario.imgData;
    }else{
      p = { sku, nombre, categoria, precio, stock, img: Inventario.imgData||'', descr };
      state.products.unshift(p);
    }
    DB.save(state);
    Inventario.renderTabla();
    alert('Producto guardado.');
  },
  renderTabla(){
    const q = (document.getElementById('invSearch').value||'').toLowerCase();
    const cat = (document.getElementById('invCat').value||'').toLowerCase();
    const rows = state.products.filter(p=>{
      const okQ = p.nombre.toLowerCase().includes(q) || (p.sku||'').toLowerCase().includes(q);
      const okC = !cat || (p.categoria||'').toLowerCase()===cat;
      return okQ && okC;
    }).map(p=>{
      const stockBadge = p.stock>5? '<span class="badge ok">OK</span>' : p.stock>0? '<span class="badge warn">Bajo</span>' : '<span class="badge bad">Agotado</span>';
      return `<tr>
        <td>${esc(p.sku)}</td>
        <td>${esc(p.nombre)}</td>
        <td>${esc(p.categoria||'')}</td>
        <td>${money(p.precio)}</td>
        <td>${p.stock} ${stockBadge}</td>
        <td>
          <button class="btn small" onclick="Inventario.edit('${p.sku}')">Editar</button>
          <button class="btn danger small" onclick="Inventario.del('${p.sku}')">Borrar</button>
        </td>
      </tr>`;
    }).join('');
    document.getElementById('invTabla').innerHTML = `<table>
      <thead><tr><th>SKU</th><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Stock</th><th></th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6">Sin productos</td></tr>'}</tbody>
    </table>`;
  },
  edit(sku){
    const p = state.products.find(x=>x.sku===sku); if(!p) return;
    document.getElementById('prodSku').value = p.sku;
    document.getElementById('prodNombre').value = p.nombre;
    document.getElementById('prodCategoria').value = p.categoria||'';
    document.getElementById('prodPrecio').value = p.precio;
    document.getElementById('prodStock').value = p.stock;
    document.getElementById('prodDescr').value = p.descr||'';
    window.scrollTo({top:0,behavior:'smooth'});
  },
  del(sku){
    if(!confirm('¿Eliminar producto?')) return;
    state.products = state.products.filter(x=>x.sku!==sku);
    DB.save(state);
    Inventario.renderTabla();
  },
  exportCSV(){
    const rows = [['SKU','Nombre','Categoría','Precio','Stock']]
      .concat(state.products.map(p=>[p.sku,p.nombre,p.categoria||'',p.precio,p.stock]));
    downloadCSV('inventario.csv', rows);
  }
};

const Clientes = {
  limpiar(){
    ['cliNombre','cliTel','cliEmail'].forEach(id=>document.getElementById(id).value='');
  },
  guardar(){
    const nombre = document.getElementById('cliNombre').value.trim();
    if(!nombre){ alert('Nombre es obligatorio.'); return; }
    const tel = document.getElementById('cliTel').value.trim();
    const email = document.getElementById('cliEmail').value.trim();
    let c = state.customers.find(x=>x.nombre===nombre && x.tel===tel);
    if(c){ c.email=email; }
    else{
      const id = 'C'+(Date.now().toString(36));
      c = {id, nombre, tel, email};
      state.customers.unshift(c);
    }
    DB.save(state);
    Clientes.renderTabla();
    Ventas.fillClientes();
    Membresias.fillClientes();
    alert('Cliente guardado.');
  },
  renderTabla(){
    const q = (document.getElementById('cliSearch').value||'').toLowerCase();
    const rows = state.customers.filter(c=> (c.nombre||'').toLowerCase().includes(q) || (c.tel||'').toLowerCase().includes(q) || (c.email||'').toLowerCase().includes(q))
      .map(c=> `<tr><td>${esc(c.nombre)}</td><td>${esc(c.tel||'')}</td><td>${esc(c.email||'')}</td></tr>`).join('');
    document.getElementById('cliTabla').innerHTML = `<table>
      <thead><tr><th>Nombre</th><th>Teléfono</th><th>Email</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="3">Sin clientes</td></tr>'}</tbody>
    </table>`;
  }
};

const Membresias = {
  fillClientes(){
    const sel = document.getElementById('memCliente');
    sel.innerHTML = '';
    state.customers.forEach(c=>{
      const opt = document.createElement('option');
      opt.value = c.id; opt.textContent = c.nombre;
      sel.appendChild(opt);
    });
    const today = new Date().toISOString().slice(0,10);
    const fin = Membresias.calcFin('Visita', today);
    document.getElementById('memInicio').value = today;
    document.getElementById('memFin').value = fin;
  },
  changeTipo(){
    const tipo = document.getElementById('memTipo').value;
    const inicio = document.getElementById('memInicio').value || new Date().toISOString().slice(0,10);
    document.getElementById('memFin').value = Membresias.calcFin(tipo, inicio);
  },
  calcFin(tipo, inicio){
    switch(tipo){
      case 'Visita': return inicio;
      case 'Semana': return addDays(inicio, 7);
      case 'Mensualidad': return addDays(inicio, 30);
      case '6 Meses': return addDays(inicio, 182);
      case '12 Meses': return addDays(inicio, 365);
      case 'VIP': return addDays(inicio, 365*5);
      case 'Promo 2x$500': return addDays(inicio, 30);
      default: return inicio;
    }
  },
  guardar(){
    const cliente = document.getElementById('memCliente').value;
    const tipo = document.getElementById('memTipo').value;
    const inicio = document.getElementById('memInicio').value;
    const fin = document.getElementById('memFin').value;
    const notas = document.getElementById('memNotas').value || '';
    const id = 'M'+Date.now().toString(36);
    state.memberships.unshift({ id, cliente, tipo, inicio, fin, notas });
    DB.save(state);
    Membresias.renderTabla();
    Dashboard.render();
    alert('Membresía registrada.');
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
      const status = Membresias.status(m);
      const okS = !st || st===status;
      return okQ && okS;
    }).map(m=>{
      const c = state.customers.find(x=>x.id===m.cliente);
      const name = c? c.nombre : m.cliente;
      const status = Membresias.status(m);
      const badge = status==='activa' ? '<span class="badge ok">Activa</span>' :
                    status==='próxima' ? '<span class="badge warn">Próx. a vencer</span>' :
                    '<span class="badge bad">Vencida</span>';
      return `<tr>
        <td>${esc(name)}</td>
        <td>${esc(m.tipo)}</td>
        <td>${esc(m.inicio)}</td>
        <td>${esc(m.fin)}</td>
        <td>${badge}</td>
        <td>${esc(m.notas||'')}</td>
      </tr>`;
    }).join('');
    document.getElementById('memTabla').innerHTML = `<table>
      <thead><tr><th>Cliente</th><th>Tipo</th><th>Inicio</th><th>Fin</th><th>Estado</th><th>Notas</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6">Sin registros</td></tr>'}</tbody>
    </table>`;
  }
};

const Cafeteria = {
  render(){
    const cont = document.getElementById('cafGrid');
    cont.innerHTML = '';
    const cafeItems = state.products.filter(p=>(p.categoria||'').toLowerCase()==='cafetería' || (p.categoria||'').toLowerCase()==='cafeteria');
    if(cafeItems.length===0){
      cont.innerHTML = '<div>No hay productos de cafetería. Agrega en Inventario.</div>';
      return;
    }
    cafeItems.forEach(p=>{
      const card = document.createElement('div');
      card.className = 'card-prod';
      const img = p.img || '';
      card.innerHTML = `<img src="${img}" alt="">
        <div class="pbody">
          <div class="pname">${esc(p.nombre)}</div>
          <div class="pprice">${money(p.precio)}</div>
          <div class="pbtns">
            <button class="btn small" onclick="Ventas.addCarrito('${p.sku}', 1)">Agregar</button>
            <button class="btn secondary small" onclick="UI.goto('ventas')">Ir a cobrar</button>
          </div>
        </div>`;
      cont.appendChild(card);
    });
  }
};

const Historial = {
  renderTabla(){
    const q = (document.getElementById('histSearch').value||'').toLowerCase();
    const d1 = document.getElementById('histDesde').value;
    const d2 = document.getElementById('histHasta').value;
    const rows = state.sales.filter(s=>{
      const okQ = (s.folio||'').toLowerCase().includes(q) ||
                  (getClienteNombre(s.cliente)||'').toLowerCase().includes(q) ||
                  (s.pagos||[]).some(p=>(p.metodo||'').toLowerCase().includes(q));
      const fecha = s.fecha.slice(0,10);
      const okD1 = !d1 || fecha >= d1;
      const okD2 = !d2 || fecha <= d2;
      return okQ && okD1 && okD2;
    }).map(s=>{
      const pagos = (s.pagos||[]).map(p=>`${p.metodo}:${money(p.monto)}`).join(' / ') || '—';
      const items = s.items.map(i=>`${esc(i.nombre)} x${i.qty}`).join(', ');
      return `<tr>
        <td>${esc(s.folio)}</td>
        <td>${s.fecha.replace('T',' ').slice(0,16)}</td>
        <td>${esc(getClienteNombre(s.cliente)||'')}</td>
        <td>${esc(items)}</td>
        <td>${money(s.total)}</td>
        <td>${esc(pagos)}</td>
        <td><button class="btn small" onclick="Tickets.renderByFolio('${s.folio}')">Ticket</button></td>
      </tr>`;
    }).join('');
    document.getElementById('histTabla').innerHTML = `<table>
      <thead><tr><th>Folio</th><th>Fecha</th><th>Cliente</th><th>Items</th><th>Total</th><th>Pagos</th><th></th></tr></thead>
      <tbody>${rows || '<tr><td colspan="7">Sin ventas</td></tr>'}</tbody>
    </table>`;
  },
  exportCSV(){
    const rows = [['Folio','Fecha','Cliente','Items','Total','Pagos']].concat(
      state.sales.map(s=>[
        s.folio, s.fecha, getClienteNombre(s.cliente)||'',
        s.items.map(i=>`${i.nombre} x${i.qty}`).join('; '),
        s.total, (s.pagos||[]).map(p=>`${p.metodo}:${p.monto}`).join(' / ')
      ])
    );
    downloadCSV('historial_ventas.csv', rows);
  }
};

const Config = {
  guardar(){
    const iva = parseFloat(document.getElementById('cfgIVA').value||'16');
    const mensaje = document.getElementById('cfgMensaje').value || 'Gracias por tu compra en Dinamita Gym 💥';
    state.settings.iva = isNaN(iva)?16:iva;
    state.settings.mensaje = mensaje;
    DB.save(state);
    alert('Configuración guardada.');
  },
  reset(){
    state.settings.iva = 16;
    state.settings.mensaje = 'Gracias por tu compra en Dinamita Gym 💥';
    state.settings.logo = DEFAULT_LOGO;
    DB.save(state);
    Config.renderLogo();
    alert('Configuración restablecida.');
  },
  loadLogo(input){
    const file = input.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = e=>{
      state.settings.logo = e.target.result;
      DB.save(state);
      Config.renderLogo();
    };
    reader.readAsDataURL(file);
  },
  renderLogo(){
    const img = document.getElementById('brandLogo');
    const timg = document.getElementById('ticketLogo');
    img.src = state.settings.logo || DEFAULT_LOGO;
    timg.src = state.settings.logo || DEFAULT_LOGO;
    document.getElementById('cfgIVA').value = state.settings.iva||16;
    document.getElementById('cfgMensaje').value = state.settings.mensaje||'';
  }
};

const Tickets = {
  render(venta){
    const body = document.getElementById('ticketBody');
    body.innerHTML = '';
    const lines = [];
    lines.push(center('-- DINAMITA GYM --'));
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
    lines.push(padRight('SUBTOTAL', 20) + padLeft(money(venta.subtotal), 12));
    lines.push(padRight('IVA', 20) + padLeft(money(venta.iva), 12));
    lines.push(padRight('TOTAL', 20) + padLeft(money(venta.total), 12));
    const metodos = (venta.pagos||[]).map(p=>p.metodo).join('/');
    lines.push('Pago: '+(metodos||'NA'));
    lines.push(repeat('-',32));
    body.innerHTML = '<pre>'+lines.join('\\n')+'</pre>';
    document.getElementById('ticketMsg').textContent = state.settings.mensaje||'';
  },
  renderByFolio(folio){
    const v = state.sales.find(s=>s.folio===folio);
    if(!v){ alert('Venta no encontrada'); return; }
    Tickets.render(v);
    UI.goto('ticket');
  },
  print(){
    window.print();
  }
};

function getClienteNombre(id){
  const c = state.customers.find(x=>x.id===id);
  return c? c.nombre : '';
}

function esc(x){ return (x||'').replace(/[&<>"]/g, s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s])); }
function money(n){ return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(n||0); }
function repeat(ch, n){ return new Array(n+1).join(ch); }
function center(text){ const w=32; const pad=Math.max(0, Math.floor((w-text.length)/2)); return ' '.repeat(pad)+text; }
function padRight(text,n){ return (text+' '.repeat(n)).slice(0,n); }
function padLeft(text,n){ return (' '.repeat(n)+text).slice(-n); }
function truncate(s, n){ return s.length>n? s.slice(0,n-1)+'…' : s; }
function downloadCSV(filename, rows){
  const csv = rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(',')).join('\\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
}

window.addEventListener('DOMContentLoaded', UI.init);
