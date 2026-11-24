'use strict';

const catalogOptions = [
  { id: 'categorias', label: 'Categorías' },
  { id: 'marcas', label: 'Marcas' },
  { id: 'modelos', label: 'Modelos' },
  { id: 'proveedores', label: 'Proveedores' },
  { id: 'lotes', label: 'Lotes' },
  { id: 'sintomas', label: 'Síntomas' },
  { id: 'intervenciones', label: 'Tipos de intervención' }
];

const catalogSchemas = {
  categorias: { id: 'ID_CATEGORIA', fields: [
    { key: 'codigo_categoria', label: 'Código', required: true },
    { key: 'nombre', label: 'Nombre', required: true }
  ] },
  marcas: { id: 'ID_MARCA', fields: [
    { key: 'codigo_marca', label: 'Código', required: true },
    { key: 'nombre', label: 'Nombre', required: true }
  ] },
  modelos: { id: 'ID_MODELO', fields: [
    { key: 'codigo_modelo', label: 'Código', required: true },
    { key: 'nombre', label: 'Nombre', required: true },
    { key: 'MARCA_id_marca', label: 'Marca', required: true, source: 'marcas', sourceId: 'ID_MARCA' },
    { key: 'CATEGORIA_id_categoria', label: 'Categoría', required: true, source: 'categorias', sourceId: 'ID_CATEGORIA' }
  ] },
  proveedores: { id: 'ID_PROVEEDOR', fields: [
    { key: 'codigo_proveedor', label: 'Código', required: true },
    { key: 'nombre', label: 'Nombre', required: true },
    { key: 'correo', label: 'Correo' },
    { key: 'telefono', label: 'Teléfono' }
  ] },
  lotes: { id: 'ID_LOTE', fields: [
    { key: 'codigo_lote', label: 'Código', required: true },
    { key: 'fecha_recepcion', label: 'Fecha de recepción', type: 'date', required: true },
    { key: 'PROVEEDOR_id_proveedor', label: 'Proveedor', required: true, source: 'proveedores', sourceId: 'ID_PROVEEDOR' },
    { key: 'MODELO_id_modelo', label: 'Modelo', required: true, source: 'modelos', sourceId: 'ID_MODELO' }
  ] },
  sintomas: { id: 'ID_SINTOMA', fields: [
    { key: 'codigo_sintoma', label: 'Código', required: true },
    { key: 'nombre', label: 'Nombre', required: true },
    { key: 'descripcion', label: 'Descripción', required: true }
  ] },
  intervenciones: { id: 'ID_TIPO_INTERVENCION', fields: [
    { key: 'codigo_tipo', label: 'Código', required: true },
    { key: 'nombre', label: 'Nombre', required: true },
    { key: 'descripcion', label: 'Descripción' }
  ] }
};

function today() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function daysBefore(dateText, days) {
  const date = new Date(dateText + 'T12:00:00');
  date.setDate(date.getDate() - days);
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

Vue.createApp({
  data() {
    return {
      loading: true, busy: false, user: null, tab: 'inicio',
      message: { kind: '', text: '' },
      loginForm: { correo: '', clave: '' },
      sections: [
        { id: 'inicio', label: 'Inicio' }, { id: 'catalogos', label: 'Catálogos' },
        { id: 'clientes', label: 'Clientes' }, { id: 'unidades', label: 'Unidades' },
        { id: 'ventas', label: 'Ventas' }, { id: 'devoluciones', label: 'Devoluciones' },
        { id: 'servicio', label: 'Servicio técnico' }, { id: 'historial', label: 'Historial' },
        { id: 'analisis', label: 'Análisis' }, { id: 'cuentas', label: 'Cuentas', supervisor: true }
      ],
      catalogOptions, catalogType: 'categorias', catalogForm: {}, catalogEditId: null, showCatalogForm: false,
      catalogQuery: '', catalogResults: null,
      catalogOptionQueries: {}, catalogOptionResults: {},
      catalogs: { categorias: [], marcas: [], modelos: [], proveedores: [], lotes: [], sintomas: [], intervenciones: [] },
      clients: [], clientResults: null, clientSearch: '', clientEditId: null, showClientForm: false,
      clientOptionQuery: '', clientOptionResults: null,
      clientForm: { codigo_cliente: '', nombre: '', correo: '', telefono: '' },
      units: [], unitResults: null, unitSearch: '', unitStatusFilter: 'TODAS', showUnitForm: false,
      unitForm: { codigo_interno: '', numero_serie: '', fecha_ingreso: today(), LOTE_id_lote: '' },
      sales: [], saleDetails: [], selectedSale: null, saleUnitSearch: '', saleCandidates: null, saleAvailable: [], saleSearchTimer: null,
      returnDetailQuery: '', returnDetailResults: null,
      saleForm: { codigo_venta: '', fecha_venta: today(), CLIENTE_id_cliente: '', unidades: [] }, showSaleForm: false,
      returns: [], returnAction: '', serviceAction: '',
      returnOpenQuery: '', returnOpenResults: null, returnOpenList: [], serviceOpenQuery: '', serviceOpenResults: null, serviceOpenList: [],
      serviceUnitQuery: '', serviceUnitResults: null, serviceEligible: [],
      returnForm: { codigo_devolucion: '', fecha_devolucion: today(), DETALLE_VENTA_id_detalle_venta: '', motivo: '' },
      returnClose: { id: '', fecha_cierre: today(), destino_final: '' },
      services: [],
      serviceForm: { codigo_servicio: '', fecha_ingreso: today(), UNIDAD_id_unidad: '', DEVOLUCION_id_devolucion: '', SINTOMA_id_sintoma: '', diagnostico: '' },
      serviceClose: { id: '', fecha_cierre: today(), TIPO_INTERVENCION_id_tipo: '', resultado: '', destino_final: '' },
      componentForm: { id: '', nombre: '', cantidad: 1, observacion: '' }, components: [],
      historyUnit: '', historySelectedUnit: null, history: [], historyQuery: '', historyMatches: [], accounts: [],
      accountForm: { nombre: '', correo: '', perfil: 'OPERADOR', clave: '' },
      accountEditId: null, showAccountForm: false, accountQuery: '', accountProfile: 'TODOS', accountStatus: 'TODOS',
      analysis: null, analysisStart: daysBefore(today(), 365), analysisDate: today(), analysisView: 'devoluciones',
      dashboardMonth: today().slice(0, 7), dashboardData: null, dashboardFindings: null, globalQuery: '',
      globalSearchBusy: false, searchVolume: 0, searchNotice: false, searchNoticeTimer: null,
      searchTimer: null, optionTimers: {}, pageInfo: {}, loadingMore: false,
      listQueries: { sales: '', returns: '', services: '' },
      listResults: { sales: null, returns: null, services: null }
    };
  },
  computed: {
    isSupervisor() { return this.user?.perfil === 'SUPERVISOR'; },
    visibleSections() { return this.sections.filter((item) => !item.supervisor || this.isSupervisor); },
    catalogFields() {
      return catalogSchemas[this.catalogType].fields.map((field) => {
        if (!field.source) return field;
        return { ...field, options: (this.catalogOptionResults[field.source] ?? this.catalogs[field.source]).map((item) => ({
          id: item[field.sourceId], label: item.NOMBRE || item.CODIGO_LOTE
        })) };
      });
    },
    catalogItems() { return this.catalogResults ?? this.catalogs[this.catalogType]; },
    catalogIdField() { return catalogSchemas[this.catalogType].id; },
    catalogListFields() {
      const first = this.catalogItems[0];
      return first ? Object.keys(first) : [this.catalogIdField, ...catalogSchemas[this.catalogType].fields.map((field) => field.key.toUpperCase())];
    },
    availableUnits() { return this.saleCandidates ?? this.saleAvailable; },
    clientOptions() { return this.clientOptionResults ?? this.clients; },
    returnDetailOptions() { return this.returnDetailResults ?? this.saleDetails; },
    serviceUnitOptions() {
      return this.serviceUnitResults ?? this.serviceEligible;
    },
    returnOpenOptions() { return this.returnOpenResults ?? this.returnOpenList; },
    serviceReturnOptions() {
      if (!this.serviceForm.UNIDAD_id_unidad) return [];
      return this.returnOpenOptions.filter((item) =>
        Number(item.ID_UNIDAD) === Number(this.serviceForm.UNIDAD_id_unidad));
    },
    serviceOpenOptions() { return this.serviceOpenResults ?? this.serviceOpenList; },
    visibleSales() { return this.listResults.sales ?? this.sales; },
    visibleReturns() { return this.listResults.returns ?? this.returns; },
    visibleServices() { return this.listResults.services ?? this.services; },
    visibleClients() { return this.clientResults ?? this.clients; },
    visibleUnits() {
      const items = this.unitResults ?? this.units;
      return this.unitStatusFilter === 'TODAS' ? items : items.filter((item) => item.ESTADO_ACTUAL === this.unitStatusFilter);
    },
    soldUnits() { return this.units.filter((item) => ['VENDIDA', 'REVISION', 'ENTREGADA'].includes(item.ESTADO_ACTUAL)); },
    openReturns() { return this.returns.filter((item) => !item.FECHA_CIERRE); },
    openServices() { return this.services.filter((item) => !item.FECHA_CIERRE); },
    reviewUnits() { return this.units.filter((item) => item.ESTADO_ACTUAL === 'REVISION'); },
    dashboardWeeks() {
      const result = Array.from({ length: 5 }, (_, i) => ({ label: 'Semana ' + (i + 1), ventas: 0, devoluciones: 0 }));
      for (const row of this.dashboardData?.semanas || []) {
        const index = Number(row.SEMANA) - 1;
        if (index >= 0 && index < 5) {
          result[index][row.TIPO === 'VENTA' ? 'ventas' : 'devoluciones'] = Number(row.TOTAL);
        }
      }
      return result;
    },
    dashboardScale() {
      return Math.max(1, ...this.dashboardWeeks.flatMap((w) => [w.ventas, w.devoluciones]));
    },
    recentOperations() {
      return [
        ...this.sales.map((v) => ({ id: v.ID_VENTA, codigo: v.CODIGO_VENTA,
          tipo: 'Venta', unidad: v.UNIDADES + ' unidad(es)', fecha: v.FECHA_VENTA,
          responsable: v.OPERADOR, estado: 'Confirmada', tab: 'ventas' })),
        ...this.returns.map((d) => ({ id: d.ID_DEVOLUCION, codigo: d.CODIGO_DEVOLUCION,
          tipo: 'Devolución', unidad: d.CODIGO_INTERNO, fecha: d.FECHA_DEVOLUCION,
          responsable: d.OPERADOR, estado: d.FECHA_CIERRE ? 'Cerrada' : 'En revisión', tab: 'devoluciones' })),
        ...this.services.map((s) => ({ id: s.ID_SERVICIO, codigo: s.CODIGO_SERVICIO,
          tipo: 'Servicio técnico', unidad: s.CODIGO_INTERNO, fecha: s.FECHA_INGRESO,
          responsable: s.OPERADOR, estado: s.FECHA_CIERRE ? 'Cerrado' : 'Abierto', tab: 'servicio' }))
      ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 6);
    },
    visibleAccounts() {
      const q = this.accountQuery.toLowerCase();
      return this.accounts.filter((item) =>
        (!q || [item.NOMBRE, item.CORREO].some((value) => String(value || '').toLowerCase().includes(q))) &&
        (this.accountProfile === 'TODOS' || item.PERFIL === this.accountProfile) &&
        (this.accountStatus === 'TODOS' || Number(item.ACTIVO) === Number(this.accountStatus)));
    },
    selectedSaleTotal() {
      return this.selectedSale?.detalles.reduce((sum, line) => sum + Number(line.PRECIO_VENTA || 0), 0) || 0;
    },
    dashboardAvailabilityPct() {
      const summary = this.dashboardData?.resumen;
      return summary?.UNIDADES_TOTAL ? Math.round(summary.UNIDADES_DISPONIBLES * 100 / summary.UNIDADES_TOTAL) : 0;
    },
    dashboardFindingCount() {
      if (!this.dashboardFindings) return 0;
      return this.dashboardFindings.primeras_devoluciones.hallazgos.length +
        this.dashboardFindings.reincidencias.hallazgos.length;
    },
    dashboardFindingBadges() {
      if (!this.dashboardFindings) return [];
      return [
        ...this.dashboardFindings.primeras_devoluciones.hallazgos.map((item) => ({
          text: item.lote + ' · ' + item.tasa_lote + ' % dev.', type: 'return'
        })),
        ...this.dashboardFindings.reincidencias.hallazgos.map((item) => ({
          text: item.sintoma + ' · ' + item.tasa_intervencion + ' % reing.', type: 'service'
        }))
      ].slice(0, 2);
    },
    featuredFinding() {
      if (!this.analysis) return null;
      return this.analysisView === 'devoluciones'
        ? this.analysis.primeras_devoluciones.hallazgos[0] || null
        : this.analysis.reincidencias.hallazgos[0] || null;
    },
    analysisKpis() {
      const h = this.featuredFinding;
      if (!h) return [];
      return this.analysisView === 'devoluciones' ? [
        { value: h.tasa_lote + ' %', label: 'Tasa del lote' },
        { value: h.tasa_otros_lotes + ' %', label: 'Otros lotes del modelo' },
        { value: '+' + h.diferencia_puntos + ' pp', label: 'Diferencia' },
        { value: h.devoluciones_lote + ' de ' + h.vendidas_lote, label: 'Primeras devoluciones' }
      ] : [
        { value: h.tasa_intervencion + ' %', label: 'Reingresos de la intervención' },
        { value: h.tasa_otras_intervenciones + ' %', label: 'Otras intervenciones' },
        { value: '+' + h.diferencia_puntos + ' pp', label: 'Diferencia' },
        { value: h.reincidencias_intervencion + ' de ' + h.cerrados_intervencion, label: 'Reingresos' }
      ];
    },
    selectedReturnDetail() {
      return this.saleDetails.find((item) => Number(item.ID_DETALLE_VENTA) === Number(this.returnForm.DETALLE_VENTA_id_detalle_venta));
    },
    selectedHistoryUnit() {
      return this.historySelectedUnit?.ID_UNIDAD === Number(this.historyUnit)
        ? this.historySelectedUnit : this.units.find((item) => item.ID_UNIDAD === Number(this.historyUnit));
    },
    initials() {
      return (this.user?.nombre || '').split(/\s+/).slice(0, 2)
        .map((part) => part[0] || '').join('').toUpperCase();
    }
  },
  async mounted() {
    window.addEventListener('popstate', this.restoreLocation);
    window.addEventListener('hashchange', this.restoreLocation);
    this.restoreLocation();
    try {
      const info = await this.api('/api/me');
      this.user = info.user;
      this.restoreLocation();
      await this.loadAll();
      if (this.historyUnit) await this.ensureHistoryUnit();
    } catch (error) {
      if (error.status !== 401) this.showError(error);
    } finally {
      this.loading = false;
    }
  },
  methods: {
    restoreLocation() {
      const [, section, id] = window.location.hash.match(/^#\/(inicio|catalogos|clientes|unidades|ventas|devoluciones|servicio|historial|analisis|cuentas)(?:\/(\d+))?$/) || [];
      this.tab = section === 'cuentas' && !this.isSupervisor ? 'inicio' : (section || 'inicio');
      if (section === 'historial' && id) {
        this.historyUnit = Number(id);
        this.historySelectedUnit = null;
        this.historyMatches = [];
        this.history = [];
        if (this.user && !this.loading) this.ensureHistoryUnit();
      } else if (section === 'historial') {
        this.historyUnit = '';
        this.historySelectedUnit = null;
        this.historyQuery = '';
        this.historyMatches = [];
        this.history = [];
      }
      this.clearMessage();
    },
    navigate(section, options = {}) {
      if (section === 'cuentas' && !this.isSupervisor) section = 'inicio';
      const suffix = section === 'historial' && options.unitId ? '/' + options.unitId : '';
      const hash = '#/' + section + suffix;
      if (window.location.hash !== hash) {
        window.history[options.replace ? 'replaceState' : 'pushState']({ section }, '', hash);
      }
      this.tab = section;
      if (section === 'historial' && !options.unitId) {
        this.historyUnit = '';
        this.historySelectedUnit = null;
        this.historyQuery = '';
        this.historyMatches = [];
        this.history = [];
      }
      this.clearMessage();
      const scroller = document.querySelector('.content');
      if (scroller) scroller.scrollTop = 0;
      window.scrollTo(0, 0);
    },
    async runGlobalSearch() {
      const term = this.globalQuery.trim();
      if (!term || this.globalSearchBusy) return;
      this.globalSearchBusy = true;
      clearTimeout(this.searchNoticeTimer);
      this.searchNotice = this.searchVolume > 200;
      this.clearMessage();
      try {
        const { encontrado } = await this.api('/api/search?q=' + encodeURIComponent(term));
        if (!encontrado) {
          this.showError(new Error('No se encontró una unidad, cliente o venta con ese dato'));
        } else if (encontrado.tipo === 'unidad') {
          const unit = encontrado.item;
          if (!this.units.some((item) => item.ID_UNIDAD === unit.ID_UNIDAD)) this.units.unshift(unit);
          await this.openHistory(unit);
        } else if (encontrado.tipo === 'cliente') {
          this.clientSearch = encontrado.item.CODIGO_CLIENTE;
          this.navigate('clientes');
          this.searchClients();
        } else if (encontrado.tipo === 'venta') {
          const sale = encontrado.item;
          if (!this.sales.some((item) => item.ID_VENTA === sale.ID_VENTA)) this.sales.unshift(sale);
          this.navigate('ventas');
          this.showSuccess('Venta encontrada: ' + sale.CODIGO_VENTA);
        }
      } catch (error) { this.showError(error); }
      finally {
        this.globalSearchBusy = false;
        this.searchNoticeTimer = setTimeout(() => { this.searchNotice = false; }, 6000);
      }
    },
    async api(path, options = {}) {
      const response = await fetch(path, {
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        ...options
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(body.error || 'No se pudo completar la operación');
        error.status = response.status;
        throw error;
      }
      return body;
    },
    clearMessage() { this.message = { kind: '', text: '' }; },
    showError(error) { this.message = { kind: 'error', text: error.message || 'Ocurrió un error' }; },
    showSuccess(text) { this.message = { kind: 'success', text }; },
    async action(work, success) {
      this.busy = true;
      this.clearMessage();
      try {
        await work();
        await this.loadAll();
        this.showSuccess(success);
      } catch (error) { this.showError(error); }
      finally { this.busy = false; }
    },
    async login() {
      this.busy = true;
      this.clearMessage();
      try {
        const info = await this.api('/api/login', { method: 'POST', body: JSON.stringify(this.loginForm) });
        this.user = info.user;
        this.loginForm.clave = '';
        this.navigate('inicio', { replace: true });
        await this.loadAll();
      } catch (error) { this.showError(error); }
      finally { this.busy = false; }
    },
    async logout() {
      try { await this.api('/api/logout', { method: 'POST' }); }
      finally {
        this.user = null;
        this.history = [];
        this.navigate('inicio', { replace: true });
        clearTimeout(this.searchNoticeTimer);
        this.searchNotice = false;
        this.clearMessage();
      }
    },
    async loadAll() {
      const types = this.catalogOptions.map((item) => item.id);
      const base = [
        ['/api/clients', (data) => { this.clients = data.items; this.rememberPage('clients', data); }],
        ['/api/units', (data) => { this.units = data.items; this.rememberPage('units', data); }],
        ['/api/units?eligible=sale', (data) => { this.saleAvailable = data.items; this.rememberPage('saleAvailable', data); }],
        ['/api/units?eligible=service', (data) => { this.serviceEligible = data.items; }],
        ['/api/sales', (data) => { this.sales = data.items; this.rememberPage('sales', data); }],
        ['/api/sales/details', (data) => { this.saleDetails = data.items; this.rememberPage('details', data); }],
        ['/api/returns', (data) => { this.returns = data.items; this.rememberPage('returns', data); }],
        ['/api/returns?open=1', (data) => { this.returnOpenList = data.items; }],
        ['/api/service', (data) => { this.services = data.items; this.rememberPage('services', data); }],
        ['/api/service?open=1', (data) => { this.serviceOpenList = data.items; }]
      ];
      base.push(['/api/search/volume', (data) => { this.searchVolume = Number(data.total) || 0; }]);
      base.push(['/api/dashboard?mes=' + encodeURIComponent(this.dashboardMonth),
        (data) => { this.dashboardData = data; }]);
      base.push(['/api/analysis', (data) => { this.dashboardFindings = data; }]);
      if (this.isSupervisor) base.push(['/api/accounts', (data) => { this.accounts = data.items; }]);
      const requests = [
        ...types.map((type) => ['/api/catalogs/' + type, (data) => {
          this.catalogs[type] = data.items;
          this.rememberPage('catalog:' + type, data);
        }]),
        ...base
      ];
      for (let index = 0; index < requests.length; index += 5) {
        await Promise.all(requests.slice(index, index + 5)
          .map(async ([url, apply]) => apply(await this.api(url))));
      }
      this.catalogQuery = '';
      this.catalogResults = null;
      this.catalogOptionQueries = {};
      this.catalogOptionResults = {};
      this.clientSearch = '';
      this.clientResults = null;
      this.clientOptionQuery = '';
      this.clientOptionResults = null;
      this.unitSearch = '';
      this.unitStatusFilter = 'TODAS';
      this.unitResults = null;
      this.saleUnitSearch = '';
      this.saleCandidates = null;
      this.returnDetailQuery = '';
      this.returnDetailResults = null;
      this.returnOpenQuery = '';
      this.returnOpenResults = null;
      this.serviceOpenQuery = '';
      this.serviceOpenResults = null;
      this.serviceUnitQuery = '';
      this.serviceUnitResults = null;
      this.listQueries = { sales: '', returns: '', services: '' };
      this.listResults = { sales: null, returns: null, services: null };
    },
    rememberPage(key, data) {
      this.pageInfo[key] = { hasMore: Boolean(data.has_more), nextOffset: data.next_offset };
    },
    pageKey(kind) {
      if (kind === 'catalog') return 'catalog:' + this.catalogType + (this.catalogQuery.trim() ? ':q:' + this.catalogQuery.trim() : '');
      if (kind === 'clients') return 'clients' + (this.clientSearch.trim() ? ':q:' + this.clientSearch.trim() : '');
      if (kind === 'units') return 'units' + (this.unitSearch.trim() || this.unitStatusFilter !== 'TODAS'
        ? ':q:' + this.unitSearch.trim() + ':status:' + this.unitStatusFilter : '');
      return kind + (this.listQueries[kind]?.trim() ? ':q:' + this.listQueries[kind].trim() : '');
    },
    moreAvailable(kind) { return Boolean(this.pageInfo[this.pageKey(kind)]?.hasMore); },
    async loadMore(kind) {
      const key = this.pageKey(kind);
      const page = this.pageInfo[key];
      if (!page?.hasMore || this.loadingMore) return;
      this.loadingMore = true;
      const path = kind === 'catalog' ? '/api/catalogs/' + this.catalogType :
        ({ clients: '/api/clients', units: '/api/units', sales: '/api/sales',
          returns: '/api/returns', services: '/api/service' })[kind];
      const params = new URLSearchParams({ offset: String(page.nextOffset) });
      const q = kind === 'catalog' ? this.catalogQuery.trim() :
        kind === 'clients' ? this.clientSearch.trim() :
          kind === 'units' ? this.unitSearch.trim() : this.listQueries[kind].trim();
      if (q) params.set('q', q);
      if (kind === 'units' && this.unitStatusFilter !== 'TODAS') params.set('estado', this.unitStatusFilter);
      try {
        const data = await this.api(path + '?' + params);
        if (this.pageKey(kind) !== key) return;
        const target = kind === 'catalog' ? (this.catalogQuery.trim() ? this.catalogResults : this.catalogs[this.catalogType]) :
          kind === 'clients' ? (this.clientSearch.trim() ? this.clientResults : this.clients) :
            kind === 'units' ? (this.unitSearch.trim() || this.unitStatusFilter !== 'TODAS' ? this.unitResults : this.units) :
              (this.listQueries[kind].trim() ? this.listResults[kind] : this[kind]);
        if (target) target.push(...data.items);
        this.rememberPage(key, data);
      } catch (error) { this.showError(error); }
      finally { this.loadingMore = false; }
    },
    async loadDashboard() {
      try { this.dashboardData = await this.api('/api/dashboard?mes=' + encodeURIComponent(this.dashboardMonth)); }
      catch (error) { this.showError(error); }
    },
    async loadCatalogType() {
      try {
        const info = await this.api('/api/catalogs/' + this.catalogType);
        this.catalogs[this.catalogType] = info.items;
        this.rememberPage('catalog:' + this.catalogType, info);
        this.catalogQuery = '';
        this.catalogResults = null;
      } catch (error) { this.showError(error); }
    },
    searchCatalog() {
      clearTimeout(this.searchTimer);
      const type = this.catalogType;
      const term = this.catalogQuery.trim();
      if (!term) { this.catalogResults = null; return; }
      this.searchTimer = setTimeout(async () => {
        try {
          const data = await this.api('/api/catalogs/' + type + '?q=' + encodeURIComponent(term));
          if (this.catalogType === type && this.catalogQuery.trim() === term) {
            this.catalogResults = data.items;
            this.rememberPage(this.pageKey('catalog'), data);
          }
        } catch (error) { this.showError(error); }
      }, 250);
    },
    resetCatalogForm() { this.catalogForm = {}; this.catalogEditId = null; this.showCatalogForm = false; },
    async editCatalog(item) {
      this.catalogEditId = item[this.catalogIdField];
      this.showCatalogForm = true;
      this.catalogForm = {};
      for (const field of catalogSchemas[this.catalogType].fields) {
        let value = item[field.key.toUpperCase()];
        if (field.type === 'date' && value) value = String(value).slice(0, 10);
        this.catalogForm[field.key] = value ?? '';
      }
      try {
        await Promise.all(catalogSchemas[this.catalogType].fields.filter((field) => field.source).map(async (field) => {
          const id = Number(this.catalogForm[field.key]);
          if (!id || this.catalogs[field.source].some((option) => option[field.sourceId] === id)) return;
          const item = (await this.api('/api/catalogs/' + field.source + '/' + id)).item;
          this.catalogs[field.source].push(item);
        }));
      } catch (error) { this.showError(error); }
      this.scrollContentTop();
    },
    searchOption(kind) {
      clearTimeout(this.optionTimers[kind]);
      const catalogSource = kind.startsWith('catalog:') ? kind.slice(8) : null;
      const config = catalogSource ? {
        term: this.catalogOptionQueries[catalogSource], path: '/api/catalogs/' + catalogSource,
        apply: (items) => { this.catalogOptionResults[catalogSource] = items; }
      } : ({
        client: { term: this.clientOptionQuery, path: '/api/clients', apply: (items) => { this.clientOptionResults = items; } },
        detail: { term: this.returnDetailQuery, path: '/api/sales/details', apply: (items) => { this.returnDetailResults = items; } },
        returnOpen: { term: this.returnOpenQuery, path: '/api/returns?open=1', apply: (items) => { this.returnOpenResults = items; } },
        serviceOpen: { term: this.serviceOpenQuery, path: '/api/service?open=1', apply: (items) => { this.serviceOpenResults = items; } },
        serviceUnit: { term: this.serviceUnitQuery, path: '/api/units?eligible=service', apply: (items) => { this.serviceUnitResults = items; } }
      })[kind];
      if (!config) return;
      const term = String(config.term || '').trim();
      if (!term) { config.apply(null); return; }
      this.optionTimers[kind] = setTimeout(async () => {
        try {
          const separator = config.path.includes('?') ? '&' : '?';
          const data = await this.api(config.path + separator + 'q=' + encodeURIComponent(term));
          const current = catalogSource ? this.catalogOptionQueries[catalogSource] :
            ({ client: this.clientOptionQuery, detail: this.returnDetailQuery,
              returnOpen: this.returnOpenQuery, serviceOpen: this.serviceOpenQuery,
              serviceUnit: this.serviceUnitQuery })[kind];
          if (String(current || '').trim() === term) config.apply(data.items);
        } catch (error) { this.showError(error); }
      }, 250);
    },
    rememberSelectedOption(kind, id) {
      const catalogSource = kind.startsWith('catalog:') ? kind.slice(8) : null;
      const source = catalogSource ? this.catalogOptionResults[catalogSource] :
        ({ client: this.clientOptionResults, detail: this.returnDetailResults,
          returnOpen: this.returnOpenResults, serviceOpen: this.serviceOpenResults,
          serviceUnit: this.serviceUnitResults })[kind];
      const target = catalogSource ? this.catalogs[catalogSource] :
        ({ client: this.clients, detail: this.saleDetails, returnOpen: this.returnOpenList,
          serviceOpen: this.serviceOpenList, serviceUnit: this.serviceEligible })[kind];
      const key = catalogSource ? catalogSchemas[catalogSource].id :
        ({ client: 'ID_CLIENTE', detail: 'ID_DETALLE_VENTA', returnOpen: 'ID_DEVOLUCION',
          serviceOpen: 'ID_SERVICIO', serviceUnit: 'ID_UNIDAD' })[kind];
      const item = source?.find((entry) => Number(entry[key]) === Number(id));
      if (item && !target.some((entry) => Number(entry[key]) === Number(id))) target.push(item);
    },
    async saveCatalog() {
      const type = this.catalogType;
      const id = this.catalogEditId;
      await this.action(async () => {
        await this.api('/api/catalogs/' + type + (id ? '/' + id : ''), {
          method: id ? 'PATCH' : 'POST', body: JSON.stringify(this.catalogForm)
        });
        this.resetCatalogForm();
      }, id ? 'Catálogo actualizado' : 'Registro agregado al catálogo');
    },
    resetClientForm() {
      this.clientEditId = null;
      this.showClientForm = false;
      this.clientForm = { codigo_cliente: '', nombre: '', correo: '', telefono: '' };
    },
    resetUnitForm() {
      this.showUnitForm = false;
      this.unitForm = { codigo_interno: '', numero_serie: '', fecha_ingreso: today(), LOTE_id_lote: '' };
    },
    editClient(item) {
      this.clientEditId = item.ID_CLIENTE;
      this.showClientForm = true;
      this.clientForm = { codigo_cliente: item.CODIGO_CLIENTE, nombre: item.NOMBRE,
        correo: item.CORREO || '', telefono: item.TELEFONO || '' };
      this.scrollContentTop();
    },
    async saveClient() {
      const id = this.clientEditId;
      await this.action(async () => {
        await this.api('/api/clients' + (id ? '/' + id : ''), {
          method: id ? 'PATCH' : 'POST', body: JSON.stringify(this.clientForm)
        });
        this.resetClientForm();
      }, id ? 'Cliente actualizado' : 'Cliente registrado');
    },
    searchClients() {
      clearTimeout(this.searchTimer);
      const term = this.clientSearch.trim();
      if (!term) { this.clientResults = null; return; }
      this.searchTimer = setTimeout(async () => {
        try {
          const data = await this.api('/api/clients?q=' + encodeURIComponent(term));
          if (this.clientSearch.trim() === term) {
            this.clientResults = data.items;
            this.rememberPage(this.pageKey('clients'), data);
          }
        }
        catch (error) { this.showError(error); }
      }, 250);
    },
    searchUnits() {
      clearTimeout(this.searchTimer);
      const term = this.unitSearch.trim();
      const status = this.unitStatusFilter;
      if (!term && status === 'TODAS') { this.unitResults = null; return; }
      this.searchTimer = setTimeout(async () => {
        try {
          const params = new URLSearchParams();
          if (term) params.set('q', term);
          if (status !== 'TODAS') params.set('estado', status);
          const data = await this.api('/api/units?' + params);
          if (this.unitSearch.trim() === term && this.unitStatusFilter === status) {
            this.unitResults = data.items;
            this.rememberPage(this.pageKey('units'), data);
          }
        }
        catch (error) { this.showError(error); }
      }, 250);
    },
    searchOperationList(kind) {
      clearTimeout(this.searchTimer);
      const term = this.listQueries[kind].trim();
      if (!term) { this.listResults[kind] = null; return; }
      this.searchTimer = setTimeout(async () => {
        try {
          const data = await this.api('/api/' + (kind === 'services' ? 'service' : kind) +
            '?q=' + encodeURIComponent(term));
          if (this.listQueries[kind].trim() === term) {
            this.listResults[kind] = data.items;
            this.rememberPage(this.pageKey(kind), data);
          }
        } catch (error) { this.showError(error); }
      }, 250);
    },
    async createUnit() {
      await this.action(async () => {
        await this.api('/api/units', { method: 'POST', body: JSON.stringify(this.unitForm) });
        this.resetUnitForm();
      }, 'Unidad registrada');
    },
    selectSaleUnit(unit) {
      if (!this.units.some((item) => item.ID_UNIDAD === unit.ID_UNIDAD)) this.units.unshift(unit);
      if (!this.saleForm.unidades.some((line) => Number(line.id_unidad) === unit.ID_UNIDAD)) {
        this.saleForm.unidades.push({ id_unidad: unit.ID_UNIDAD, precio_venta: '' });
      }
    },
    searchSaleUnits() {
      clearTimeout(this.saleSearchTimer);
      const term = this.saleUnitSearch.trim();
      if (!term) { this.saleCandidates = null; return; }
      this.saleSearchTimer = setTimeout(async () => {
        try {
          const data = await this.api('/api/units?eligible=sale&q=' + encodeURIComponent(term));
          if (this.saleUnitSearch.trim() === term) {
            this.saleCandidates = data.items;
            this.rememberPage('saleCandidates:' + term, data);
          }
        } catch (error) { this.showError(error); }
      }, 250);
    },
    async loadMoreSaleUnits() {
      const term = this.saleUnitSearch.trim();
      const key = term ? 'saleCandidates:' + term : 'saleAvailable';
      const page = this.pageInfo[key];
      if (!page?.hasMore || this.loadingMore) return;
      this.loadingMore = true;
      try {
        const params = new URLSearchParams({ eligible: 'sale', offset: String(page.nextOffset) });
        if (term) params.set('q', term);
        const data = await this.api('/api/units?' + params);
        if (this.saleUnitSearch.trim() !== term) return;
        (term ? this.saleCandidates : this.saleAvailable).push(...data.items);
        this.rememberPage(key, data);
      } catch (error) { this.showError(error); }
      finally { this.loadingMore = false; }
    },
    removeSaleLine(index) { this.saleForm.unidades.splice(index, 1); },
    saleUnit(id) { return this.units.find((unit) => unit.ID_UNIDAD === Number(id)); },
    resetSaleForm() {
      this.showSaleForm = false;
      this.saleUnitSearch = '';
      this.saleCandidates = null;
      clearTimeout(this.saleSearchTimer);
      this.saleForm = { codigo_venta: '', fecha_venta: today(), CLIENTE_id_cliente: '', unidades: [] };
    },
    startSaleForm() {
      this.selectedSale = null;
      this.showSaleForm = true;
    },
    async selectRegisteredSale(sale) {
      if (!sale) return;
      this.resetSaleForm();
      this.selectedSale = null;
      try {
        this.selectedSale = (await this.api('/api/sales/' + sale.ID_VENTA)).item;
        this.scrollContentTop();
      } catch (error) { this.showError(error); }
    },
    async openRecent(item) {
      this.navigate(item.tab);
      if (item.tab === 'ventas') await this.selectRegisteredSale(this.sales.find((sale) => sale.ID_VENTA === item.id));
    },
    statusClass(status) {
      return ({
        DISPONIBLE: 'status-available', VENDIDA: 'status-sold', REVISION: 'status-review',
        EN_SERVICIO: 'status-service', ENTREGADA: 'status-delivered', BAJA: 'status-retired',
        ABIERTA: 'status-review', ABIERTO: 'status-service', CERRADO: 'status-delivered',
        'En revisión': 'status-review', Confirmada: 'status-sold', Abierto: 'status-service',
        Cerrado: 'status-delivered', Cerrada: 'status-delivered'
      })[status] || 'neutral';
    },
    resetReturnForms() {
      this.returnAction = '';
      this.returnForm = { codigo_devolucion: '', fecha_devolucion: today(),
        DETALLE_VENTA_id_detalle_venta: '', motivo: '' };
      this.returnClose = { id: '', fecha_cierre: today(), destino_final: '' };
      this.returnDetailQuery = '';
      this.returnDetailResults = null;
      this.returnOpenQuery = '';
      this.returnOpenResults = null;
    },
    chooseReturnAction(action) {
      if (this.returnAction === action) this.resetReturnForms();
      else this.returnAction = action;
    },
    resetServiceForms() {
      this.serviceAction = '';
      this.serviceForm = { codigo_servicio: '', fecha_ingreso: today(), UNIDAD_id_unidad: '',
        DEVOLUCION_id_devolucion: '', SINTOMA_id_sintoma: '', diagnostico: '' };
      this.serviceClose = { id: '', fecha_cierre: today(), TIPO_INTERVENCION_id_tipo: '',
        resultado: '', destino_final: '' };
      this.componentForm = { id: '', nombre: '', cantidad: 1, observacion: '' };
      this.components = [];
      this.serviceUnitQuery = '';
      this.serviceUnitResults = null;
      this.serviceOpenQuery = '';
      this.serviceOpenResults = null;
      this.returnOpenQuery = '';
      this.returnOpenResults = null;
    },
    chooseServiceAction(action) {
      if (this.serviceAction === action) this.resetServiceForms();
      else this.serviceAction = action;
    },
    async createSale() {
      if (!this.saleForm.unidades.length) return this.showError(new Error('Selecciona al menos una unidad disponible'));
      await this.action(async () => {
        await this.api('/api/sales', { method: 'POST', body: JSON.stringify(this.saleForm) });
        this.resetSaleForm();
      }, 'Venta registrada y unidades actualizadas');
    },
    async createReturn() {
      await this.action(async () => {
        await this.api('/api/returns', { method: 'POST', body: JSON.stringify(this.returnForm) });
        this.resetReturnForms();
      }, 'Devolución registrada');
    },
    async closeReturn() {
      await this.action(async () => {
        await this.api('/api/returns/' + this.returnClose.id + '/close', {
          method: 'PATCH', body: JSON.stringify(this.returnClose)
        });
        this.resetReturnForms();
      }, 'Destino confirmado');
    },
    async createService() {
      let openedId;
      await this.action(async () => {
        const result = await this.api('/api/service', { method: 'POST', body: JSON.stringify(this.serviceForm) });
        openedId = result.id;
        this.serviceForm = { codigo_servicio: '', fecha_ingreso: today(), UNIDAD_id_unidad: '',
          DEVOLUCION_id_devolucion: '', SINTOMA_id_sintoma: '', diagnostico: '' };
      }, 'Servicio técnico abierto');
      if (openedId) {
        this.componentForm.id = openedId;
        this.serviceClose.id = openedId;
        this.serviceAction = 'component';
        await this.loadComponents();
      }
    },
    async closeService() {
      await this.action(async () => {
        await this.api('/api/service/' + this.serviceClose.id + '/close', {
          method: 'PATCH', body: JSON.stringify(this.serviceClose)
        });
        this.resetServiceForms();
      }, 'Servicio cerrado y destino confirmado');
    },
    async addComponent() {
      await this.action(async () => {
        const id = this.componentForm.id;
        await this.api('/api/service/' + id + '/components', {
          method: 'POST', body: JSON.stringify(this.componentForm)
        });
        this.componentForm = { id, nombre: '', cantidad: 1, observacion: '' };
        await this.loadComponents();
      }, 'Componente registrado');
    },
    async loadComponents() {
      if (!this.componentForm.id) { this.components = []; return; }
      const response = await this.api('/api/service/' + this.componentForm.id + '/components');
      this.components = response.items;
    },
    async refreshComponents() {
      try { await this.loadComponents(); }
      catch (error) { this.showError(error); }
    },
    async openHistory(item) {
      this.historyUnit = item.ID_UNIDAD;
      this.historySelectedUnit = item;
      this.historyQuery = item.CODIGO_INTERNO;
      clearTimeout(this.searchTimer);
      this.historyMatches = [];
      this.navigate('historial', { unitId: item.ID_UNIDAD });
      await this.loadHistory();
    },
    async searchHistoryUnits() {
      clearTimeout(this.searchTimer);
      const term = this.historyQuery.trim();
      if (!term) {
        this.historyUnit = '';
        this.historySelectedUnit = null;
        this.historyMatches = [];
        this.history = [];
        return;
      }
      if (this.selectedHistoryUnit &&
          ![this.selectedHistoryUnit.CODIGO_INTERNO, this.selectedHistoryUnit.NUMERO_SERIE]
            .some((value) => String(value || '').toLowerCase() === term.toLowerCase())) {
        this.historyUnit = '';
        this.historySelectedUnit = null;
        this.history = [];
      }
      this.searchTimer = setTimeout(async () => {
        try {
          const matches = (await this.api('/api/units/suggest?q=' + encodeURIComponent(term))).items;
          if (this.historyQuery.trim() === term) this.historyMatches = matches;
        } catch (error) { this.showError(error); }
      }, 250);
    },
    async selectHistorySuggestion(unit) {
      if (!this.units.some((item) => item.ID_UNIDAD === unit.ID_UNIDAD)) this.units.unshift(unit);
      await this.openHistory(unit);
    },
    historyPickerSearch() {
      if (!this.historyQuery.trim() && this.historyUnit) {
        this.historyMatches = [];
        return;
      }
      this.searchHistoryUnits();
    },
    selectHistoryPicker(id) {
      const unit = [...this.historyMatches, ...this.units]
        .find((item) => Number(item.ID_UNIDAD) === Number(id));
      if (unit) this.selectHistorySuggestion(unit);
    },
    async ensureHistoryUnit() {
      if (!this.historyUnit) return;
      const id = Number(this.historyUnit);
      try {
        let unit = this.units.find((item) => item.ID_UNIDAD === id);
        if (!unit) {
          unit = (await this.api('/api/units/' + id)).item;
          this.units.unshift(unit);
        }
        if (Number(this.historyUnit) !== id) return;
        this.historySelectedUnit = unit;
        this.historyQuery = unit.CODIGO_INTERNO;
        await this.loadHistory();
      } catch (error) { this.showError(error); }
    },
    async loadHistory() {
      if (!this.historyUnit) { this.history = []; return; }
      const id = Number(this.historyUnit);
      try {
        const items = (await this.api('/api/units/' + id + '/history')).items;
        if (Number(this.historyUnit) === id) this.history = items;
      }
      catch (error) { this.showError(error); }
    },
    async loadAnalysis() {
      this.busy = true;
      this.clearMessage();
      try {
        if (this.analysisStart > this.analysisDate) throw new Error('La fecha inicial no puede ser posterior a la fecha de corte');
        const query = '?desde=' + encodeURIComponent(this.analysisStart) +
          '&fecha=' + encodeURIComponent(this.analysisDate);
        this.analysis = await this.api('/api/analysis' + query);
      } catch (error) { this.showError(error); }
      finally { this.busy = false; }
    },
    printReport() { window.print(); },
    resetAccountForm() {
      this.accountEditId = null;
      this.accountForm = { nombre: '', correo: '', perfil: 'OPERADOR', clave: '' };
    },
    editAccount(item) {
      this.accountEditId = item.ID_USUARIO;
      this.showAccountForm = true;
      this.accountForm = { nombre: item.NOMBRE, correo: item.CORREO,
        perfil: item.PERFIL, clave: '' };
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    async createAccount() {
      const id = this.accountEditId;
      await this.action(async () => {
        const payload = { ...this.accountForm };
        if (id && !payload.clave) delete payload.clave;
        await this.api('/api/accounts' + (id ? '/' + id : ''), {
          method: id ? 'PATCH' : 'POST', body: JSON.stringify(payload)
        });
        this.resetAccountForm();
        this.showAccountForm = false;
      }, id ? 'Cuenta actualizada' : 'Cuenta creada');
    },
    async toggleAccount(item) {
      await this.action(() => this.api('/api/accounts/' + item.ID_USUARIO, {
        method: 'PATCH', body: JSON.stringify({ activo: item.ACTIVO ? 0 : 1 })
      }), 'Cuenta actualizada');
    },
    dateOnly(value) {
      if (!value) return '';
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        const [year, month, day] = value.slice(0, 10).split('-');
        return day + '-' + month + '-' + year;
      }
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('es-CL');
    },
    display(value) {
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return this.dateOnly(value);
      return String(value);
    },
    money(value) {
      return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value) || 0);
    },
    dateTime(value) {
      return value ? new Date(value).toLocaleString('es-CL') : '';
    },
    scrollContentTop() {
      const scroller = document.querySelector('.content');
      if (scroller) scroller.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}).component('search-picker', searchPicker).mount('#app');
