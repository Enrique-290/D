// === Claves de almacenamiento ===
const LS = {
  productos: "din_plus_productos",
  ventas: "din_plus_ventas",
  clientes: "din_plus_clientes",
  cfg: "din_plus_cfg",
  membresias: "din_plus_membresias"
};

function load(key, def){ try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; } }
function save(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

// === Estado ===
let productos = load(LS.productos, [
  {id: crypto.randomUUID(), nombre:"Proteína Whey 2lb", precio:650, costo:420, stock:10, categoria:"Suplementos", foto:null},
  {id: crypto.randomUUID(), nombre:"Guantes entrenamiento", precio:250, costo:120, stock:15, categoria:"Accesorios", foto:null},
  {id: crypto.randomUUID(), nombre:"Creatina 300g", precio:480, costo:300, stock:8, categoria:"Suplementos", foto:null}
]);
let ventas = load(LS.ventas, []);
let clientes = load(LS.clientes, []);
let cfg = load(LS.cfg, {ivaPct: 0});
let membresias = load(LS.membresias, []);

save(LS.productos, productos);
save(LS.ventas, ventas);
save(LS.clientes, clientes);
save(LS.cfg, cfg);
save(LS.membresias, membresias);

// === UI base ===
const sections = document.querySelectorAll(".section");
const navLinks = document.querySelectorAll(".nav-link");
const sidebar = document.getElementById("sidebar");
const menuToggle = document.getElementById("menuToggle");
const sectionTitle = document.getElementById("sectionTitle");

menuToggle.addEventListener("click", () => {
  sidebar.classList.toggle("open");
  sidebar.classList.toggle("closed");
});

navLinks.forEach(btn => {
  btn.addEventListener("click", () => {
    navLinks.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const id = btn.dataset.section;
    sections.forEach(s => s.classList.remove("visible"));
    document.getElementById(id).classList.add("visible");
    sectionTitle.textContent = btn.textContent;
  });
});

// ===== Ventas =====
const selProducto = document.getElementById("ventaProducto");
const inpCant = document.getElementById("ventaCantidad");
const inpPrecio = document.getElementById("ventaPrecio");
const btnAgregarCarrito = document.getElementById("agregarCarrito");
const btnVaciarCarrito = document.getElementById("vaciarCarrito");
const tbodyCarrito = document.querySelector("#tablaCarrito tbody");
const lblSubtotal = document.getElementById("subTotal");
const lblIva = document.getElementById("ivaMonto");
const lblTotal = document.getElementById("granTotal");
const lblIvaPct = document.getElementById("ivaPctLabel");
const inpClienteVenta = document.getElementById("clienteVenta");
const btnCobrar = document.getElementById("btnCobrar");
const pagosLista = document.getElementById("pagosLista");
const btnAddPago = document.getElementById("addPago");
const lblPagado = document.getElementById("pagadoMonto");

let carrito = [];
let pagos = [];

function cargarProductosVenta() {
  selProducto.innerHTML = "";
  productos.forEach(p => {
    const op = document.createElement("option");
    op.value = p.id;
    op.textContent = `${p.nombre} — $${p.precio.toFixed(2)} (Stock: ${p.stock})`;
    selProducto.appendChild(op);
  });
  actualizarPrecioPorProducto();
}

function actualizarPrecioPorProducto() {
  const p = productos.find(x => x.id === selProducto.value);
  if (p) inpPrecio.value = p.precio;
}
selProducto.addEventListener("change", actualizarPrecioPorProducto);

btnAgregarCarrito.addEventListener("click", () => {
  const prod = productos.find(p => p.id === selProducto.value);
  const cant = Number(inpCant.value || 1);
  const precio = Number(inpPrecio.value || prod.precio);
  if (!prod || cant <= 0 || precio < 0) return;
  if (cant > prod.stock) { alert("Stock insuficiente"); return; }
  carrito.push({id: crypto.randomUUID(), prodId: prod.id, nombre: prod.nombre, cantidad: cant, precio});
  renderCarrito();
});

btnVaciarCarrito.addEventListener("click", () => {
  carrito = []; pagos = [];
  renderCarrito(); renderPagos();
});

function renderCarrito() {
  tbodyCarrito.innerHTML = "";
  let subtotal = 0;
  carrito.forEach(item => {
    const imp = item.cantidad * item.precio;
    subtotal += imp;
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${item.nombre}</td>
                    <td>${item.cantidad}</td>
                    <td>$${item.precio.toFixed(2)}</td>
                    <td>$${imp.toFixed(2)}</td>
                    <td><button data-id="${item.id}" class="secondary btnDelete">✕</button></td>`;
    tbodyCarrito.appendChild(tr);
  });
  tbodyCarrito.querySelectorAll(".btnDelete").forEach(b => b.addEventListener("click", e => {
    const id = e.currentTarget.dataset.id;
    carrito = carrito.filter(x => x.id !== id);
    renderCarrito();
  }));
  const ivaMonto = subtotal * (cfg.ivaPct/100);
  const total = subtotal + ivaMonto;
  lblSubtotal.textContent = `$${subtotal.toFixed(2)}`;
  lblIva.textContent = `$${ivaMonto.toFixed(2)}`;
  lblTotal.textContent = `$${total.toFixed(2)}`;
  lblIvaPct.textContent = cfg.ivaPct;
  renderPagos(total);
}

function renderPagos(total = 0){
  pagosLista.innerHTML = "";
  let pagado = 0;
  pagos.forEach((pago, idx) => {
    pagado += pago.monto;
    const wrap = document.createElement("div");
    wrap.className = "actions";
    wrap.innerHTML = `
      <select class="met">
        <option ${pago.metodo==="Efectivo"?"selected":""}>Efectivo</option>
        <option ${pago.metodo==="Tarjeta"?"selected":""}>Tarjeta</option>
        <option ${pago.metodo==="Transferencia"?"selected":""}>Transferencia</option>
      </select>
      <input type="number" step="0.01" class="mon" value="${pago.monto}"/>
      <button class="danger del">Quitar</button>
    `;
    pagosLista.appendChild(wrap);
    const met = wrap.querySelector(".met");
    const mon = wrap.querySelector(".mon");
    wrap.querySelector(".del").addEventListener("click", () => {
      pagos.splice(idx,1); renderPagos(total);
    });
    met.addEventListener("change", () => { pago.metodo = met.value; });
    mon.addEventListener("input", () => { pago.monto = Number(mon.value||0); actualizarTotalPagado(); });
  });
  lblPagado.textContent = `$${pagado.toFixed(2)} / $${total.toFixed(2)}`;
  function actualizarTotalPagado(){
    let p = 0; pagos.forEach(x=>p+=Number(x.monto||0));
    lblPagado.textContent = `$${p.toFixed(2)} / $${total.toFixed(2)}`;
  }
}

btnAddPago.addEventListener("click", ()=>{
  pagos.push({metodo:"Efectivo", monto:0});
  renderPagos(parseFloat(lblTotal.textContent.replace(/[^\d.]/g,""))||0);
});

btnCobrar.addEventListener("click", () => {
  if (carrito.length === 0) { alert("Carrito vacío"); return; }
  const total = parseFloat(lblTotal.textContent.replace(/[^\d.]/g,"")) || 0;
  const pagado = pagos.reduce((a,b)=>a + Number(b.monto||0), 0);
  if (Math.abs(pagado - total) > 0.01) {
    alert("El total pagado debe igualar el total de la venta.");
    return;
  }
  // validar stock
  for (const it of carrito) {
    const p = productos.find(x => x.id === it.prodId);
    if (!p || it.cantidad > p.stock) { alert("Stock insuficiente"); return; }
  }
  // descontar stock
  carrito.forEach(it => {
    const p = productos.find(x => x.id === it.prodId);
    p.stock -= it.cantidad;
  });
  save(LS.productos, productos);
  cargarProductosVenta();
  renderTablaProductos();
  renderTablaInventario();

  // registrar venta
  const folio = "DV-" + Date.now().toString().slice(-8);
  const subtotal = carrito.reduce((a,b)=>a + b.cantidad*b.precio, 0);
  const iva = subtotal * (cfg.ivaPct/100);
  const venta = {
    id: crypto.randomUUID(),
    folio,
    fecha: new Date().toISOString(),
    items: carrito.map(x=>({nombre:x.nombre, cantidad:x.cantidad, precio:x.precio})),
    pagos: pagos.slice(),
    subtotal, iva, total
  };
  ventas.unshift(venta);
  save(LS.ventas, ventas);
  renderHistorial();
  // ticket
  abrirTicket(venta);
  // limpiar
  carrito = []; pagos = [];
  renderCarrito(); renderPagos(total);
});

function abrirTicket(v) {
  const metodos = v.pagos.map(p=>`${p.metodo}: $${Number(p.monto).toFixed(2)}`).join(" + ");
  const win = window.open("", "_blank");
  win.document.write(`<html><head><meta charset="UTF-8"><title>Ticket ${v.folio}</title>
    <style>
      body{font-family:Arial;padding:12px}
      h2{margin:0 0 8px}
      table{width:100%;border-collapse:collapse}
      th,td{border-bottom:1px solid #ddd;padding:4px 0}
      tfoot td{font-weight:bold}
      .center{text-align:center}
      .right{text-align:right}
    </style>
  </head><body>
  <h2 class="center">Dinamita Gym 💥</h2>
  <div>Folio: ${v.folio}</div>
  <div>Fecha: ${new Date(v.fecha).toLocaleString()}</div>
  <div>Pago: ${metodos}</div>
  <hr/>
  <table>
    <thead><tr><th>Producto</th><th class="right">Cant.</th><th class="right">Precio</th><th class="right">Importe</th></tr></thead>
    <tbody>
      ${v.items.map(it => `<tr><td>${it.nombre}</td><td class="right">${it.cantidad}</td><td class="right">$${it.precio.toFixed(2)}</td><td class="right">$${(it.cantidad*it.precio).toFixed(2)}</td></tr>`).join("")}
    </tbody>
    <tfoot>
      <tr><td colspan="3" class="right">Subtotal</td><td class="right">$${v.subtotal.toFixed(2)}</td></tr>
      <tr><td colspan="3" class="right">IVA (${cfg.ivaPct}%)</td><td class="right">$${v.iva.toFixed(2)}</td></tr>
      <tr><td colspan="3" class="right">Total</td><td class="right">$${v.total.toFixed(2)}</td></tr>
    </tfoot>
  </table>
  <p class="center">¡Gracias por tu compra en Dinamita Gym 💥!</p>
  <script>window.print()</script>
  </body></html>`);
  win.document.close();
}

// ===== Catálogo =====
const tablaProductos = document.querySelector("#tablaProductos tbody");
const inpProdId = document.getElementById("prodId");
const inpProdNombre = document.getElementById("prodNombre");
const inpProdPrecio = document.getElementById("prodPrecio");
const inpProdCosto = document.getElementById("prodCosto");
const inpProdStock = document.getElementById("prodStock");
const inpProdCategoria = document.getElementById("prodCategoria");
const inpProdFoto = document.getElementById("prodFoto");
const imgPreview = document.getElementById("prodPreview");
const btnGuardarProd = document.getElementById("btnGuardarProd");
const btnNuevoProd = document.getElementById("btnNuevoProd");

inpProdFoto.addEventListener("change", e => {
  const file = e.target.files?.[0];
  if(!file) return imgPreview.style.display="none";
  const reader = new FileReader();
  reader.onload = ()=>{
    imgPreview.src = reader.result;
    imgPreview.style.display = "block";
  };
  reader.readAsDataURL(file);
});

function limpiarFormProducto(){
  inpProdId.value = "";
  inpProdNombre.value = "";
  inpProdPrecio.value = "";
  inpProdCosto.value = "";
  inpProdStock.value = "0";
  inpProdCategoria.value = "";
  inpProdFoto.value = "";
  imgPreview.style.display = "none";
}

btnNuevoProd.addEventListener("click", limpiarFormProducto);

btnGuardarProd.addEventListener("click", () => {
  const id = inpProdId.value || crypto.randomUUID();
  const nombre = inpProdNombre.value.trim();
  const precio = Number(inpProdPrecio.value||0);
  const costo = Number(inpProdCosto.value||0);
  const stock = Number(inpProdStock.value||0);
  const categoria = inpProdCategoria.value.trim();
  let foto = null;
  if (imgPreview.style.display === "block") foto = imgPreview.src;
  if(!nombre){ alert("Nombre requerido"); return; }
  const idx = productos.findIndex(p=>p.id===id);
  const prod = {id, nombre, precio, costo, stock, categoria, foto};
  if(idx>=0){ productos[idx] = prod; } else { productos.unshift(prod); }
  save(LS.productos, productos);
  limpiarFormProducto();
  renderTablaProductos();
  cargarProductosVenta();
  renderTablaInventario();
});

function renderTablaProductos(){
  tablaProductos.innerHTML = "";
  productos.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${p.foto ? `<img class="foto" src="${p.foto}"/>` : ""}</td>
    <td>${p.nombre}</td><td>$${p.precio.toFixed(2)}</td><td>${p.stock}</td><td>${p.categoria||""}</td>
    <td>
      <button class="secondary btnEdit" data-id="${p.id}">Editar</button>
      <button class="danger btnDel" data-id="${p.id}">Borrar</button>
    </td>`;
    tablaProductos.appendChild(tr);
  });
  tablaProductos.querySelectorAll(".btnEdit").forEach(b=>b.addEventListener("click", e=>{
    const id = e.currentTarget.dataset.id;
    const p = productos.find(x=>x.id===id);
    if(!p) return;
    inpProdId.value = p.id;
    inpProdNombre.value = p.nombre;
    inpProdPrecio.value = p.precio;
    inpProdCosto.value = p.costo;
    inpProdStock.value = p.stock;
    inpProdCategoria.value = p.categoria||"";
    if(p.foto){ imgPreview.src = p.foto; imgPreview.style.display="block"; } else { imgPreview.style.display="none"; }
    window.scrollTo({top:0, behavior:"smooth"});
  }));
  tablaProductos.querySelectorAll(".btnDel").forEach(b=>b.addEventListener("click", e=>{
    const id = e.currentTarget.dataset.id;
    if(!confirm("¿Borrar producto?")) return;
    productos = productos.filter(x=>x.id!==id);
    save(LS.productos, productos);
    renderTablaProductos();
    cargarProductosVenta();
    renderTablaInventario();
  }));
}

// ===== Inventario =====
const tbodyInv = document.querySelector("#tablaInventario tbody");
function renderTablaInventario() {
  tbodyInv.innerHTML = "";
  productos.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${p.nombre}</td><td>${p.stock}</td>
      <td><input type="number" min="0" value="0" class="inpEnt"></td>
      <td><input type="number" min="0" value="0" class="inpSal"></td>
      <td><button class="secondary btnAplicar">Aplicar</button></td>`;
    tbodyInv.appendChild(tr);
    const inpE = tr.querySelector(".inpEnt");
    const inpS = tr.querySelector(".inpSal");
    tr.querySelector(".btnAplicar").addEventListener("click", ()=>{
      p.stock += Number(inpE.value||0);
      p.stock -= Number(inpS.value||0);
      if (p.stock < 0) p.stock = 0;
      save(LS.productos, productos);
      renderTablaInventario();
      renderTablaProductos();
      cargarProductosVenta();
    });
  });
}

// ===== Historial =====
const tbodyHist = document.querySelector("#tablaHistorial tbody");
function renderHistorial() {
  tbodyHist.innerHTML = "";
  ventas.forEach(v => {
    const tr = document.createElement("tr");
    const fecha = new Date(v.fecha);
    const pagos = v.pagos.map(p=>`${p.metodo}: $${Number(p.monto).toFixed(2)}`).join(" + ");
    tr.innerHTML = `<td>${fecha.toLocaleString()}</td>
      <td>${v.folio}</td>
      <td>${v.items.length}</td>
      <td>${pagos}</td>
      <td>$${v.total.toFixed(2)}</td>
      <td><button class="secondary btnTicket" data-id="${v.id}">Ticket</button></td>`;
    tbodyHist.appendChild(tr);
  });
  tbodyHist.querySelectorAll(".btnTicket").forEach(b=>b.addEventListener("click", e=>{
    const id = e.currentTarget.dataset.id;
    const v = ventas.find(x=>x.id===id);
    if(v) abrirTicket(v);
  }));
}

// ===== Clientes =====
const tbodyClientes = document.querySelector("#tablaClientes tbody");
const inpCliNombre = document.getElementById("cliNombre");
const inpCliTel = document.getElementById("cliTelefono");
const inpCliCorreo = document.getElementById("cliCorreo");
const btnGuardarCliente = document.getElementById("btnGuardarCliente");
const inpBuscarCliente = document.getElementById("buscarCliente");

btnGuardarCliente.addEventListener("click", ()=>{
  const nombre = inpCliNombre.value.trim();
  if(!nombre){ alert("Nombre requerido"); return; }
  const cli = {id: crypto.randomUUID(), nombre, telefono: inpCliTel.value.trim(), correo: inpCliCorreo.value.trim()};
  clientes.unshift(cli);
  save(LS.clientes, clientes);
  inpCliNombre.value = inpCliTel.value = inpCliCorreo.value = "";
  renderTablaClientes();
});

inpBuscarCliente.addEventListener("input", renderTablaClientes);

function renderTablaClientes(){
  const q = (inpBuscarCliente.value||"").toLowerCase();
  tbodyClientes.innerHTML = "";
  clientes.filter(c => c.nombre.toLowerCase().includes(q)).forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${c.nombre}</td><td>${c.telefono||""}</td><td>${c.correo||""}</td>`;
    tbodyClientes.appendChild(tr);
  });
}

// ===== Membresías =====
const tbodyMem = document.querySelector("#tablaMembresias tbody");
const inpMemCliente = document.getElementById("memCliente");
const selMemTipo = document.getElementById("memTipo");
const btnCrearMem = document.getElementById("btnCrearMembresia");

btnCrearMem.addEventListener("click", ()=>{
  const cli = inpMemCliente.value.trim();
  if(!cli){ alert("Cliente requerido"); return; }
  const inicio = new Date();
  const fin = new Date(inicio);
  const tipo = selMemTipo.value;
  if(tipo==="Visita"){ fin.setDate(fin.getDate()+1); }
  if(tipo==="Semana"){ fin.setDate(fin.getDate()+7); }
  if(tipo==="Mensualidad"){ fin.setMonth(fin.getMonth()+1); }
  if(tipo==="6 meses"){ fin.setMonth(fin.getMonth()+6); }
  if(tipo==="12 meses"){ fin.setMonth(fin.getMonth()+12); }
  const mem = {id: crypto.randomUUID(), cliente: cli, tipo, inicio: inicio.toISOString(), fin: fin.toISOString()};
  membresias.unshift(mem);
  save(LS.membresias, membresias);
  inpMemCliente.value = "";
  renderMembresias();
});

function renderMembresias(){
  tbodyMem.innerHTML = "";
  const now = new Date();
  membresias.forEach(m => {
    const fi = new Date(m.inicio), ff = new Date(m.fin);
    const vencida = ff < now;
    const estado = vencida ? "Vencida" : "Activa";
    const badge = vencida ? 'style="background:#4a1111;border-color:#6a1616"' : 'style="background:#12331a;border-color:#144c1f"';
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${m.cliente}</td><td>${m.tipo}</td><td>${fi.toLocaleDateString()}</td><td>${ff.toLocaleDateString()}</td>
    <td><span class="badge" ${badge}>${estado}</span></td>`;
    tbodyMem.appendChild(tr);
  });
}

// ===== Admin =====
const inpCfgIVA = document.getElementById("cfgIVA");
const btnGuardarCfg = document.getElementById("btnGuardarCfg");
const btnExportar = document.getElementById("btnExportar");
const inputImportar = document.getElementById("inputImportar");
const btnBorrarTodo = document.getElementById("btnBorrarTodo");

function cargarCfg() {
  inpCfgIVA.value = cfg.ivaPct;
  document.getElementById("ivaPctLabel").textContent = cfg.ivaPct;
}

btnGuardarCfg.addEventListener("click", ()=>{
  cfg.ivaPct = Number(inpCfgIVA.value||0);
  save(LS.cfg, cfg);
  cargarCfg();
  renderCarrito();
  alert("Configuración guardada");
});

btnExportar.addEventListener("click", ()=>{
  const data = {productos, ventas, clientes, cfg, membresias};
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dinamita_backup_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

inputImportar.addEventListener("change", (e)=>{
  const file = e.target.files?.[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const data = JSON.parse(reader.result);
      if(data.productos) productos = data.productos;
      if(data.ventas) ventas = data.ventas;
      if(data.clientes) clientes = data.clientes;
      if(data.cfg) cfg = data.cfg;
      if(data.membresias) membresias = data.membresias;
      save(LS.productos, productos);
      save(LS.ventas, ventas);
      save(LS.clientes, clientes);
      save(LS.cfg, cfg);
      save(LS.membresias, membresias);
      recargarTodo();
      alert("Datos importados");
    }catch(err){ alert("Archivo inválido"); }
  };
  reader.readAsText(file);
});

btnBorrarTodo.addEventListener("click", ()=>{
  if(!confirm("Esto borrará todos los datos guardados en este navegador. ¿Continuar?")) return;
  productos = []; ventas = []; clientes = []; cfg = {ivaPct: 0}; membresias = [];
  save(LS.productos, productos);
  save(LS.ventas, ventas);
  save(LS.clientes, clientes);
  save(LS.cfg, cfg);
  save(LS.membresias, membresias);
  recargarTodo();
});

function recargarTodo(){
  cargarProductosVenta();
  renderCarrito();
  renderTablaProductos();
  renderTablaInventario();
  renderHistorial();
  renderTablaClientes();
  renderMembresias();
  cargarCfg();
}

// Init
recargarTodo();
