// ============================================================
// EstoquePro - Sistema de Gerenciamento de Estoque
// ============================================================

class InventoryApp {
  constructor() {
    this.STORAGE_KEYS = {
      PRODUCTS: 'estoquepro_products',
      SALES: 'estoquepro_sales',
      RENTAL_PRODUCTS: 'estoquepro_rental_products',
      RENTALS: 'estoquepro_rentals',
      LOANS: 'estoquepro_loans',
      SERVER_URL: 'estoquepro_server_url',
      AUTH_TOKEN: 'estoquepro_auth_token',
      USER: 'estoquepro_user'
    };

    this.products = [];
    this.sales = [];
    this.rentalProducts = [];
    this.rentals = [];
    this.loans = [];
    this.charts = {};
    this.currentSection = 'dashboard';
    this.deleteTargetId = null;
    this.refundTargetId = null;
    this.closeRentalTargetId = null;
    this.loanPaymentTargetId = null;

    // Server & Auth State
    this.serverUrl = localStorage.getItem(this.STORAGE_KEYS.SERVER_URL) || '';
    this.authToken = localStorage.getItem(this.STORAGE_KEYS.AUTH_TOKEN) || null;
    this.currentUser = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.USER)) || null;
    this.isServerOnline = false;

    this.init();
  }

  // ============ INITIALIZATION ============

  init() {
    this.loadData();
    this.bindEvents();
    this.setCurrentDate();
    this.initNavigation();
    this.initAuthAndServer();
    this.renderCurrentSection();
  }

  setCurrentDate() {
    const el = document.getElementById('current-date');
    if (el) {
      const now = new Date();
      el.textContent = now.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    }
  }

  bindEvents() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const target = item.getAttribute('data-target');
        if (target) {
          this.navigateTo(target.replace('-section', ''));
        }
      });
    });

    // Global Search (debounced)
    const searchInput = document.getElementById('global-search');
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.handleSearch(e.target.value.trim());
        }, 300);
      });
    }

    // Product Modal
    const btnNewProduct = document.getElementById('btn-new-product');
    if (btnNewProduct) {
      btnNewProduct.addEventListener('click', () => this.openProductModal());
    }

    const productForm = document.getElementById('product-form');
    if (productForm) {
      productForm.addEventListener('submit', (e) => this.handleProductSubmit(e));
    }

    // Close product modal
    document.getElementById('btn-close-product-modal')?.addEventListener('click', () => this.closeModal('product-modal'));
    document.getElementById('btn-cancel-product')?.addEventListener('click', () => this.closeModal('product-modal'));

    // Delete modal
    document.getElementById('btn-close-delete-modal')?.addEventListener('click', () => this.closeModal('delete-modal'));
    document.getElementById('btn-cancel-delete')?.addEventListener('click', () => this.closeModal('delete-modal'));
    document.getElementById('btn-confirm-delete')?.addEventListener('click', () => this.executeDelete());

    // Clear all modal
    document.getElementById('btn-clear-all')?.addEventListener('click', () => this.openClearModal());
    document.getElementById('btn-close-clear-modal')?.addEventListener('click', () => this.closeModal('clear-modal'));
    document.getElementById('btn-cancel-clear')?.addEventListener('click', () => this.closeModal('clear-modal'));
    document.getElementById('btn-confirm-clear')?.addEventListener('click', () => this.executeClearAll());

    // Access data modal
    document.getElementById('btn-close-access-modal')?.addEventListener('click', () => this.closeModal('access-data-modal'));
    document.getElementById('btn-close-access-modal-ok')?.addEventListener('click', () => this.closeModal('access-data-modal'));
    document.getElementById('btn-copy-access-data')?.addEventListener('click', () => this.copyAccessDataToClipboard());

    // Refund modal
    document.getElementById('btn-close-refund-modal')?.addEventListener('click', () => this.closeModal('refund-modal'));
    document.getElementById('btn-cancel-refund')?.addEventListener('click', () => this.closeModal('refund-modal'));
    document.getElementById('btn-confirm-refund')?.addEventListener('click', () => this.executeRefund());

    // Products table delegation
    const productsTableBody = document.getElementById('products-table-body');
    if (productsTableBody) {
      productsTableBody.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-edit');
        const deleteBtn = e.target.closest('.btn-delete');
        const accessBtn = e.target.closest('.btn-view-access-data');
        if (editBtn) this.openProductModal(editBtn.dataset.id);
        if (deleteBtn) this.openDeleteModal(deleteBtn.dataset.id);
        if (accessBtn) this.openAccessDataModal(accessBtn.dataset.id);
      });
    }

    // Sales table delegation
    const salesTableBody = document.getElementById('sales-table-body');
    if (salesTableBody) {
      salesTableBody.addEventListener('click', (e) => {
        const refundBtn = e.target.closest('.btn-refund');
        const accessBtn = e.target.closest('.btn-view-sale-access');
        if (refundBtn) this.openRefundModal(refundBtn.dataset.id);
        if (accessBtn) this.openSaleAccessModal(accessBtn.dataset.id);
      });
    }

    // Filters
    document.getElementById('category-filter')?.addEventListener('change', () => this.renderProductsTable());
    document.getElementById('sort-products')?.addEventListener('change', () => this.renderProductsTable());

    // Sale form
    const saleForm = document.getElementById('new-sale-form');
    if (saleForm) {
      saleForm.addEventListener('submit', (e) => this.handleSaleSubmit(e));
    }

    // Sale real-time calculation
    ['sale-product', 'sale-quantity', 'sale-discount', 'sale-tax-rate'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.updateSalePreview());
      document.getElementById(id)?.addEventListener('change', () => this.updateSalePreview());
    });

    // Auto-fill tax rate on product selection change
    document.getElementById('sale-product')?.addEventListener('change', (e) => {
      const p = this.products.find(x => x.id === e.target.value);
      const taxInput = document.getElementById('sale-tax-rate');
      if (p && taxInput) {
        taxInput.value = p.taxRate || 0;
        this.updateSalePreview();
      }
    });

    // Export / Import Data (Salvar/Carregar do PC)
    const handleExport = () => this.exportDataToFile();
    document.getElementById('btn-export-data')?.addEventListener('click', handleExport);
    document.getElementById('btn-export-sidebar')?.addEventListener('click', handleExport);

    const handleImportClick = () => document.getElementById('file-import-input')?.click();
    document.getElementById('btn-import-data')?.addEventListener('click', handleImportClick);
    document.getElementById('btn-import-sidebar')?.addEventListener('click', handleImportClick);

    document.getElementById('file-import-input')?.addEventListener('change', (e) => this.importDataFromFile(e));

    // Report filter
    const reportForm = document.getElementById('report-filter-form');
    if (reportForm) {
      reportForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.renderReports();
      });
    }

    // Rental Product Modal
    document.getElementById('btn-new-rental-product')?.addEventListener('click', () => this.openRentalProductModal());
    document.getElementById('btn-close-rental-product-modal')?.addEventListener('click', () => this.closeModal('rental-product-modal'));
    document.getElementById('btn-cancel-rental-product')?.addEventListener('click', () => this.closeModal('rental-product-modal'));
    document.getElementById('rental-product-form')?.addEventListener('submit', (e) => this.handleRentalProductSubmit(e));

    // Rental Modal
    document.getElementById('btn-new-rental')?.addEventListener('click', () => this.openRentalModal());
    document.getElementById('btn-close-rental-modal')?.addEventListener('click', () => this.closeModal('rental-modal'));
    document.getElementById('btn-cancel-rental')?.addEventListener('click', () => this.closeModal('rental-modal'));
    document.getElementById('rental-form')?.addEventListener('submit', (e) => this.handleRentalSubmit(e));

    // Close Rental Modal
    document.getElementById('btn-close-close-rental-modal')?.addEventListener('click', () => this.closeModal('close-rental-modal'));
    document.getElementById('btn-cancel-close-rental')?.addEventListener('click', () => this.closeModal('close-rental-modal'));
    document.getElementById('btn-confirm-close-rental')?.addEventListener('click', () => this.executeCloseRental());

    // Rental form calculations
    ['rental-product-select', 'rental-duration', 'rental-duration-unit', 'rental-start-date'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.updateRentalPreview());
      document.getElementById(id)?.addEventListener('change', () => this.updateRentalPreview());
    });

    // Rental status filter
    document.getElementById('rental-status-filter')?.addEventListener('change', () => this.renderRentalsTable());

    // Rental products table delegation
    const rentalProductsTableBody = document.getElementById('rental-products-table-body');
    if (rentalProductsTableBody) {
      rentalProductsTableBody.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-edit-rental-product');
        const deleteBtn = e.target.closest('.btn-delete-rental-product');
        const accessBtn = e.target.closest('.btn-view-rental-product-access');
        if (editBtn) this.openRentalProductModal(editBtn.dataset.id);
        if (deleteBtn) this.deleteRentalProduct(deleteBtn.dataset.id);
        if (accessBtn) this.openRentalProductAccessModal(accessBtn.dataset.id);
      });
    }

    // Rentals table delegation
    const rentalsTableBody = document.getElementById('rentals-table-body');
    if (rentalsTableBody) {
      rentalsTableBody.addEventListener('click', (e) => {
        const closeBtn = e.target.closest('.btn-close-rental');
        const accessBtn = e.target.closest('.btn-view-rental-access');
        if (closeBtn) this.openCloseRentalModal(closeBtn.dataset.id);
        if (accessBtn) this.openRentalAccessModal(accessBtn.dataset.id);
      });
    }

    // Loans Form & Preview
    document.getElementById('new-loan-form')?.addEventListener('submit', (e) => this.handleLoanSubmit(e));
    ['loan-amount', 'loan-interest-rate'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.updateLoanPreview());
      document.getElementById(id)?.addEventListener('change', () => this.updateLoanPreview());
    });

    // Loan Payment Modal
    document.getElementById('btn-close-loan-payment-modal')?.addEventListener('click', () => this.closeModal('loan-payment-modal'));
    document.getElementById('btn-cancel-loan-payment')?.addEventListener('click', () => this.closeModal('loan-payment-modal'));
    document.getElementById('loan-payment-form')?.addEventListener('submit', (e) => this.handleLoanPaymentSubmit(e));

    // Loans table delegation
    const loansTableBody = document.getElementById('loans-table-body');
    if (loansTableBody) {
      loansTableBody.addEventListener('click', (e) => {
        const payBtn = e.target.closest('.btn-pay-loan');
        const deleteBtn = e.target.closest('.btn-delete-loan');
        if (payBtn) this.openLoanPaymentModal(payBtn.dataset.id);
        if (deleteBtn) this.deleteLoan(deleteBtn.dataset.id);
      });
    }

    // Loan payments history delegation (for deleting a specific payment)
    const loanHistoryList = document.getElementById('loan-payments-history-list');
    if (loanHistoryList) {
      loanHistoryList.addEventListener('click', (e) => {
        const delPayBtn = e.target.closest('.btn-delete-payment');
        if (delPayBtn) {
          const loanId = delPayBtn.dataset.loanId;
          const payId = delPayBtn.dataset.paymentId;
          this.deleteLoanPayment(loanId, payId);
        }
      });
    }

    // Auth Tabs Switching
    document.getElementById('tab-login')?.addEventListener('click', () => this.switchAuthTab('login'));
    document.getElementById('tab-register')?.addEventListener('click', () => this.switchAuthTab('register'));

    // Auth Forms Submit
    document.getElementById('login-form')?.addEventListener('submit', (e) => this.handleLogin(e));
    document.getElementById('register-form')?.addEventListener('submit', (e) => this.handleRegister(e));

    // Continue Offline
    document.getElementById('btn-continue-offline')?.addEventListener('click', () => {
      document.getElementById('auth-overlay')?.classList.add('hidden');
      this.showToast('Modo offline local ativo. Os dados serão salvos no navegador.', 'warning');
    });

    // Logout
    document.getElementById('btn-logout')?.addEventListener('click', () => this.handleLogout());

    // Server Config Modal
    const openServerModal = () => this.openServerConfigModal();
    document.getElementById('btn-open-server-config')?.addEventListener('click', openServerModal);
    document.getElementById('btn-auth-config-server')?.addEventListener('click', openServerModal);
    document.getElementById('btn-close-server-config-modal')?.addEventListener('click', () => this.closeModal('server-config-modal'));
    document.getElementById('btn-test-server-connection')?.addEventListener('click', () => this.testServerConnection());
    document.getElementById('btn-save-server-config')?.addEventListener('click', () => this.saveServerConfig());

    // Click on modal overlay to close
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.closeModal(overlay.id);
      });
    });
  }

  initNavigation() {
    const hash = window.location.hash.substring(1);
    if (hash) {
      this.navigateTo(hash);
    } else {
      this.navigateTo('dashboard');
    }
  }

  // ============ NAVIGATION ============

  navigateTo(sectionId) {
    this.currentSection = sectionId;
    window.location.hash = sectionId;

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
      const target = item.getAttribute('data-target');
      if (target === sectionId + '-section') {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Show/hide sections
    document.querySelectorAll('.content-section').forEach(section => {
      section.classList.remove('active');
      section.classList.add('hidden');
    });

    const activeSection = document.getElementById(sectionId + '-section');
    if (activeSection) {
      activeSection.classList.remove('hidden');
      activeSection.classList.add('active');
    }

    // Update header title
    const titles = {
      dashboard: 'Dashboard',
      products: 'Produtos',
      sales: 'Vendas',
      reports: 'Relatórios',
      rental: 'Aluguel',
      loans: 'Empréstimos'
    };
    const titleEl = document.getElementById('section-title');
    if (titleEl) titleEl.textContent = titles[sectionId] || 'Dashboard';

    this.renderCurrentSection();
  }

  renderCurrentSection() {
    switch (this.currentSection) {
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'products':
        this.renderProductsTable();
        break;
      case 'sales':
        this.renderSalesSection();
        break;
      case 'reports':
        this.renderReports();
        break;
      case 'rental':
        this.renderRentalSection();
        break;
      case 'loans':
        this.renderLoansSection();
        break;
    }
    this.refreshIcons();
  }

  // ============ DATA MANAGEMENT ============

  loadData() {
    try {
      this.products = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.PRODUCTS)) || [];
      this.sales = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.SALES)) || [];
      this.rentalProducts = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.RENTAL_PRODUCTS)) || [];
      this.rentals = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.RENTALS)) || [];
      this.loans = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.LOANS)) || [];
    } catch {
      this.products = [];
      this.sales = [];
      this.rentalProducts = [];
      this.rentals = [];
      this.loans = [];
    }
  }

  saveData(syncToServer = true) {
    localStorage.setItem(this.STORAGE_KEYS.PRODUCTS, JSON.stringify(this.products));
    localStorage.setItem(this.STORAGE_KEYS.SALES, JSON.stringify(this.sales));
    localStorage.setItem(this.STORAGE_KEYS.RENTAL_PRODUCTS, JSON.stringify(this.rentalProducts));
    localStorage.setItem(this.STORAGE_KEYS.RENTALS, JSON.stringify(this.rentals));
    localStorage.setItem(this.STORAGE_KEYS.LOANS, JSON.stringify(this.loans));

    if (syncToServer) {
      this.syncDataToServer();
    }
  }

  // ============ AUTHENTICATION & SERVER SYNC ============

  switchAuthTab(tab) {
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const formLogin = document.getElementById('login-form');
    const formRegister = document.getElementById('register-form');

    if (tab === 'login') {
      tabLogin?.classList.add('active');
      tabRegister?.classList.remove('active');
      formLogin?.classList.remove('hidden');
      formRegister?.classList.add('hidden');
    } else {
      tabRegister?.classList.add('active');
      tabLogin?.classList.remove('active');
      formRegister?.classList.remove('hidden');
      formLogin?.classList.add('hidden');
    }
    this.refreshIcons();
  }

  async initAuthAndServer() {
    this.updateAuthUI();
    await this.checkServerHealth();

    if (this.authToken) {
      document.getElementById('auth-overlay')?.classList.add('hidden');
      await this.fetchDataFromServer();
    } else {
      document.getElementById('auth-overlay')?.classList.remove('hidden');
    }
    this.refreshIcons();
  }

  updateAuthUI() {
    const usernameEl = document.getElementById('current-username');
    if (usernameEl) {
      usernameEl.textContent = this.currentUser?.username || 'Modo Local';
    }
  }

  async checkServerHealth() {
    const authStatusPill = document.getElementById('auth-server-status');
    const sidebarStatusPill = document.getElementById('sidebar-server-status');

    if (!this.serverUrl) {
      this.isServerOnline = false;
      if (authStatusPill) {
        authStatusPill.className = 'server-status-pill offline';
        authStatusPill.textContent = '● Servidor não configurado';
      }
      if (sidebarStatusPill) {
        sidebarStatusPill.className = 'server-status-pill offline';
        sidebarStatusPill.textContent = '● Não configurado';
      }
      return false;
    }

    if (authStatusPill) {
      authStatusPill.className = 'server-status-pill checking';
      authStatusPill.textContent = '● Verificando...';
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${this.serverUrl}/api/health`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        this.isServerOnline = true;
        if (authStatusPill) {
          authStatusPill.className = 'server-status-pill online';
          authStatusPill.textContent = '● Servidor Conectado';
        }
        if (sidebarStatusPill) {
          sidebarStatusPill.className = 'server-status-pill online';
          sidebarStatusPill.textContent = '● Servidor Online';
        }
        return true;
      }
    } catch (e) {
      // Server is offline / unreachable
    }

    this.isServerOnline = false;
    if (authStatusPill) {
      authStatusPill.className = 'server-status-pill offline';
      authStatusPill.textContent = '● Servidor Offline';
    }
    if (sidebarStatusPill) {
      sidebarStatusPill.className = 'server-status-pill offline';
      sidebarStatusPill.textContent = '● Servidor Offline';
    }
    return false;
  }

  openServerConfigModal() {
    const input = document.getElementById('server-url-input');
    const resultDiv = document.getElementById('server-test-result');
    if (input) input.value = this.serverUrl;
    if (resultDiv) {
      resultDiv.style.display = 'none';
      resultDiv.innerHTML = '';
    }
    const modal = document.getElementById('server-config-modal');
    if (modal) modal.classList.remove('hidden');
    this.refreshIcons();
  }

  async testServerConnection() {
    const input = document.getElementById('server-url-input');
    const resultDiv = document.getElementById('server-test-result');
    if (!input || !resultDiv) return;

    let targetUrl = input.value.trim();
    if (!targetUrl) {
      resultDiv.style.display = 'block';
      resultDiv.style.color = 'var(--accent-rose)';
      resultDiv.textContent = 'Informe um endereço de servidor.';
      return;
    }

    targetUrl = targetUrl.replace(/\/+$/, '');
    resultDiv.style.display = 'block';
    resultDiv.style.color = 'var(--accent-amber)';
    resultDiv.textContent = 'Testando conexão com o servidor...';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`${targetUrl}/api/health`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        resultDiv.style.color = 'var(--accent-emerald)';
        resultDiv.innerHTML = `✅ <strong>Conectado com sucesso!</strong> (${data.app || 'Servidor'} - ${data.database || 'SQLite'})`;
        return true;
      }
    } catch (err) {
      // Fall through to error message
    }

    resultDiv.style.color = 'var(--accent-rose)';
    resultDiv.innerHTML = `❌ <strong>Não foi possível conectar.</strong> Verifique se o servidor está rodando no notebook e se a URL está correta.`;
    return false;
  }

  async saveServerConfig() {
    const input = document.getElementById('server-url-input');
    if (!input) return;

    let targetUrl = input.value.trim().replace(/\/+$/, '');
    if (!targetUrl) {
      targetUrl = 'http://localhost:3000';
    }

    this.serverUrl = targetUrl;
    localStorage.setItem(this.STORAGE_KEYS.SERVER_URL, this.serverUrl);

    this.closeModal('server-config-modal');
    this.showToast('Endereço do servidor atualizado!', 'success');

    await this.checkServerHealth();
    if (this.authToken && this.isServerOnline) {
      await this.fetchDataFromServer();
    }
  }

  async handleLogin(e) {
    e.preventDefault();

    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const submitBtn = document.getElementById('btn-submit-login');

    const username = usernameInput?.value.trim();
    const password = passwordInput?.value;

    if (!username || !password) {
      return this.showToast('Preencha o usuário e a senha.', 'error');
    }

    if (!this.isServerOnline) {
      await this.checkServerHealth();
    }

    if (!this.isServerOnline) {
      return this.showToast('Servidor offline. Verifique se o backend está rodando no notebook ou configure o endereço.', 'error');
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Entrando...</span>';
    }

    try {
      const res = await fetch(`${this.serverUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao realizar login.');
      }

      this.authToken = data.token;
      this.currentUser = data.user;
      localStorage.setItem(this.STORAGE_KEYS.AUTH_TOKEN, this.authToken);
      localStorage.setItem(this.STORAGE_KEYS.USER, JSON.stringify(this.currentUser));

      this.updateAuthUI();
      document.getElementById('auth-overlay')?.classList.add('hidden');
      this.showToast(`Bem-vindo, ${data.user.username}!`, 'success');

      await this.fetchDataFromServer();
      this.renderCurrentSection();
    } catch (err) {
      this.showToast(err.message, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i data-lucide="log-in"></i><span>Entrar no Sistema</span>';
        this.refreshIcons();
      }
    }
  }

  async handleRegister(e) {
    e.preventDefault();

    const usernameInput = document.getElementById('register-username');
    const passwordInput = document.getElementById('register-password');
    const confirmInput = document.getElementById('register-password-confirm');
    const submitBtn = document.getElementById('btn-submit-register');

    const username = usernameInput?.value.trim();
    const password = passwordInput?.value;
    const confirm = confirmInput?.value;

    if (!username || !password) {
      return this.showToast('Preencha todos os campos.', 'error');
    }

    if (password !== confirm) {
      return this.showToast('As senhas digitadas não coincidem.', 'error');
    }

    if (!this.isServerOnline) {
      await this.checkServerHealth();
    }

    if (!this.isServerOnline) {
      return this.showToast('Servidor offline. Verifique se o backend está rodando no notebook ou configure o endereço.', 'error');
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Criando conta...</span>';
    }

    try {
      const res = await fetch(`${this.serverUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao criar conta.');
      }

      this.authToken = data.token;
      this.currentUser = data.user;
      localStorage.setItem(this.STORAGE_KEYS.AUTH_TOKEN, this.authToken);
      localStorage.setItem(this.STORAGE_KEYS.USER, JSON.stringify(this.currentUser));

      this.updateAuthUI();
      document.getElementById('auth-overlay')?.classList.add('hidden');
      this.showToast('Conta criada com sucesso!', 'success');

      // Sync existing local data to new account if any exists
      await this.syncDataToServer();
      this.renderCurrentSection();
    } catch (err) {
      this.showToast(err.message, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i data-lucide="check-circle"></i><span>Criar Conta e Acessar</span>';
        this.refreshIcons();
      }
    }
  }

  handleLogout() {
    if (!confirm('Deseja realmente sair da sua conta?')) return;

    this.authToken = null;
    this.currentUser = null;
    localStorage.removeItem(this.STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(this.STORAGE_KEYS.USER);

    this.updateAuthUI();
    document.getElementById('auth-overlay')?.classList.remove('hidden');
    this.switchAuthTab('login');
    this.showToast('Você saiu da sua conta.', 'info');
  }

  async fetchDataFromServer() {
    if (!this.authToken || !this.isServerOnline) return;

    try {
      const res = await fetch(`${this.serverUrl}/api/data`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        this.products = Array.isArray(data.products) ? data.products : [];
        this.sales = Array.isArray(data.sales) ? data.sales : [];
        this.rentalProducts = Array.isArray(data.rentalProducts) ? data.rentalProducts : [];
        this.rentals = Array.isArray(data.rentals) ? data.rentals : [];
        this.loans = Array.isArray(data.loans) ? data.loans : [];

        this.saveData(false); // save to cache without re-triggering sync
        this.renderCurrentSection();
      }
    } catch (e) {
      console.warn('Não foi possível carregar dados do servidor:', e);
    }
  }

  async syncDataToServer() {
    if (!this.authToken || !this.isServerOnline) return;

    try {
      await fetch(`${this.serverUrl}/api/data/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify({
          products: this.products,
          sales: this.sales,
          rentalProducts: this.rentalProducts,
          rentals: this.rentals,
          loans: this.loans
        })
      });
    } catch (e) {
      console.warn('Erro ao sincronizar com o servidor:', e);
    }
  }

  async exportDataToFile() {
    const data = {
      app: 'EstoquePro',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      products: this.products,
      sales: this.sales,
      rentalProducts: this.rentalProducts,
      rentals: this.rentals,
      loans: this.loans
    };

    const jsonStr = JSON.stringify(data, null, 2);

    // Try modern File System Access API if available
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: `estoquepro_dados_${new Date().toISOString().split('T')[0]}.json`,
          types: [{
            description: 'Arquivo JSON de Dados do EstoquePro',
            accept: { 'application/json': ['.json'] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(jsonStr);
        await writable.close();
        this.showToast('Dados salvos no arquivo do PC com sucesso!', 'success');
        return;
      } catch (err) {
        if (err.name === 'AbortError') return; // User cancelled
      }
    }

    // Standard download fallback
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().split('T')[0];
    const a = document.createElement('a');
    a.href = url;
    a.download = `estoquepro_dados_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showToast('Arquivo de dados salvo na pasta do PC com sucesso!', 'success');
  }

  importDataFromFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed && (Array.isArray(parsed.products) || Array.isArray(parsed.rentalProducts) || Array.isArray(parsed.loans))) {
          this.products = Array.isArray(parsed.products) ? parsed.products : [];
          this.sales = Array.isArray(parsed.sales) ? parsed.sales : [];
          this.rentalProducts = Array.isArray(parsed.rentalProducts) ? parsed.rentalProducts : [];
          this.rentals = Array.isArray(parsed.rentals) ? parsed.rentals : [];
          this.loans = Array.isArray(parsed.loans) ? parsed.loans : [];
          this.saveData();
          this.renderCurrentSection();
          this.showToast('Dados carregados com sucesso a partir do arquivo do PC!', 'success');
        } else {
          this.showToast('Arquivo inválido ou em formato incompatível.', 'error');
        }
      } catch (err) {
        this.showToast('Erro ao ler o arquivo JSON.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  seedData() {
    this.products = [];
    this.sales = [];
    this.rentalProducts = [];
    this.rentals = [];
    this.loans = [];
    this.saveData();
  }

  createSaleRecord(product, qty, discount, date, taxRate = 0) {
    let subtotal = product.sellPrice * qty;
    let discountAmount = subtotal * (discount / 100);
    let total = subtotal - discountAmount;
    let feeAmount = total * (taxRate / 100);
    let cost = product.costPrice * qty;
    let profit = total - cost - feeAmount;

    return {
      id: this.generateId(),
      productId: product.id,
      productName: product.name,
      quantity: qty,
      unitPrice: product.sellPrice,
      costPrice: product.costPrice,
      discount: discount,
      fee: taxRate,
      feeAmount: feeAmount,
      total: total,
      profit: profit,
      date: date,
      accessData: product.accessData || '',
      status: 'completed'
    };
  }

  // ============ DASHBOARD ============

  renderDashboard() {
    this.updateDashboardStats();
    this.renderLowStockAlerts();
    this.renderRecentActivity();
    this.renderDashboardCharts();
  }

  updateDashboardStats() {
    // Total products
    const totalProducts = this.products.length;
    const elTotalProducts = document.getElementById('stat-total-products');
    if (elTotalProducts) this.animateValue(elTotalProducts, totalProducts);

    // Total stock value
    let stockValue = 0;
    this.products.forEach(p => stockValue += p.quantity * p.costPrice);
    const elStockValue = document.getElementById('stat-inventory-value');
    if (elStockValue) this.animateCurrency(elStockValue, stockValue);

    // Monthly sales & profit (excluding refunded)
    const now = new Date();
    let monthlySales = 0;
    let monthlyProfit = 0;

    this.sales.forEach(s => {
      if (s.status === 'refunded') return;
      const d = new Date(s.date);
      if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
        monthlySales += s.total;
        monthlyProfit += s.profit;
      }
    });

    const elMonthlySales = document.getElementById('stat-monthly-sales');
    if (elMonthlySales) this.animateCurrency(elMonthlySales, monthlySales);

    const elMonthlyProfit = document.getElementById('stat-monthly-profit');
    if (elMonthlyProfit) this.animateCurrency(elMonthlyProfit, monthlyProfit);

    // Lucro Presumido (Estoque em Mão)
    let projectedProfit = 0;
    this.products.forEach(p => {
      if (p.quantity > 0) {
        const taxRate = p.taxRate || 0;
        const feePerUnit = p.sellPrice * (taxRate / 100);
        const netUnitProfit = p.sellPrice - p.costPrice - feePerUnit;
        projectedProfit += p.quantity * netUnitProfit;
      }
    });

    const elProjectedProfit = document.getElementById('stat-projected-profit');
    if (elProjectedProfit) this.animateCurrency(elProjectedProfit, projectedProfit);

    // Update profit icon color
    const profitIcon = document.getElementById('profit-icon-wrapper');
    if (profitIcon) {
      profitIcon.className = 'stat-icon-wrapper ' + (monthlyProfit >= 0 ? 'green' : 'red');
    }
  }

  renderLowStockAlerts() {
    const container = document.getElementById('low-stock-alerts');
    if (!container) return;

    const lowStock = this.products.filter(p => p.quantity <= p.minStock);

    if (lowStock.length === 0) {
      container.innerHTML = '<div class="empty-state">✅ Todos os produtos estão com estoque regular.</div>';
      return;
    }

    container.innerHTML = lowStock.map(p => {
      const isDanger = p.quantity === 0;
      return `
        <div class="alert-item">
          <div class="alert-item-left">
            <div class="alert-dot ${isDanger ? 'danger' : 'warning'}"></div>
            <div>
              <div class="alert-name">${p.name}</div>
              <div class="alert-detail">${p.code} • ${p.category}</div>
            </div>
          </div>
          <div>
            <div class="alert-qty ${isDanger ? 'danger' : 'warning'}">${p.quantity} un.</div>
            <div class="alert-detail">Mín: ${p.minStock}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderRecentActivity() {
    const container = document.getElementById('recent-activity');
    if (!container) return;

    const recentSales = this.sales
      .filter(s => s.status !== 'refunded')
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 6);

    if (recentSales.length === 0) {
      container.innerHTML = '<div class="empty-state">Nenhuma atividade recente.</div>';
      return;
    }

    container.innerHTML = recentSales.map(s => `
      <div class="activity-item">
        <div class="activity-icon sale">
          <i data-lucide="shopping-cart" style="width:16px;height:16px;"></i>
        </div>
        <div style="flex:1;">
          <div class="activity-text">${s.quantity}x ${s.productName}</div>
          <div class="activity-time">${this.formatDate(s.date)} — ${this.formatCurrency(s.total)}</div>
        </div>
      </div>
    `).join('');

    this.refreshIcons();
  }

  renderDashboardCharts() {
    if (typeof Chart === 'undefined') return;

    // Chart.js dark theme defaults
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.95)';
    Chart.defaults.plugins.tooltip.titleColor = '#f8fafc';
    Chart.defaults.plugins.tooltip.bodyColor = '#e2e8f0';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(148, 163, 184, 0.2)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.padding = 12;

    this.renderSalesChart();
    this.renderTopProductsChart();
  }

  renderSalesChart() {
    const canvas = document.getElementById('salesChart');
    if (!canvas) return;

    if (this.charts.sales) this.charts.sales.destroy();

    const labels = [];
    const data = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      labels.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));

      let total = 0;
      this.sales.forEach(s => {
        if (s.status === 'refunded') return;
        const sd = new Date(s.date);
        if (sd.toDateString() === d.toDateString()) {
          total += s.total;
        }
      });
      data.push(total);
    }

    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 280);
    gradient.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
    gradient.addColorStop(1, 'rgba(139, 92, 246, 0.0)');

    this.charts.sales = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Vendas (R$)',
          data,
          borderColor: '#8b5cf6',
          backgroundColor: gradient,
          borderWidth: 2.5,
          pointBackgroundColor: '#a78bfa',
          pointBorderColor: '#1e1b4b',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => 'R$ ' + ctx.parsed.y.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(148, 163, 184, 0.08)' },
            ticks: { callback: v => 'R$ ' + v.toLocaleString('pt-BR') }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  }

  renderTopProductsChart() {
    const canvas = document.getElementById('topProductsChart');
    if (!canvas) return;

    if (this.charts.topProducts) this.charts.topProducts.destroy();

    const productSales = {};
    this.sales.forEach(s => {
      if (s.status === 'refunded') return;
      if (!productSales[s.productId]) {
        productSales[s.productId] = { name: s.productName, qty: 0 };
      }
      productSales[s.productId].qty += s.quantity;
    });

    const sorted = Object.values(productSales).sort((a, b) => b.qty - a.qty).slice(0, 5);
    
    if (sorted.length === 0) return;

    this.charts.topProducts = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: sorted.map(i => i.name),
        datasets: [{
          data: sorted.map(i => i.qty),
          backgroundColor: ['#8b5cf6', '#10b981', '#f59e0b', '#3b82f6', '#f43f5e'],
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#94a3b8',
              usePointStyle: true,
              padding: 16,
              font: { size: 12 }
            }
          }
        }
      }
    });
  }

  // ============ PRODUCTS ============

  renderProductsTable(searchTerm = '') {
    const tbody = document.getElementById('products-table-body');
    if (!tbody) return;

    const filterCat = document.getElementById('category-filter')?.value || 'all';
    const sortVal = document.getElementById('sort-products')?.value || 'name-asc';

    // Filter
    let filtered = this.products.filter(p => {
      const matchSearch = !searchTerm ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = filterCat === 'all' || p.category === filterCat;
      return matchSearch && matchCat;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortVal) {
        case 'name-asc': return a.name.localeCompare(b.name, 'pt-BR');
        case 'name-desc': return b.name.localeCompare(a.name, 'pt-BR');
        case 'stock-asc': return a.quantity - b.quantity;
        case 'stock-desc': return b.quantity - a.quantity;
        case 'price-asc': return a.sellPrice - b.sellPrice;
        case 'price-desc': return b.sellPrice - a.sellPrice;
        default: return 0;
      }
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="empty-state">Nenhum produto encontrado.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(p => {
      const taxRate = p.taxRate || 0;
      const feePerUnit = p.sellPrice * (taxRate / 100);
      const netUnitProfit = p.sellPrice - p.costPrice - feePerUnit;
      const margin = p.sellPrice > 0 ? ((netUnitProfit / p.sellPrice) * 100).toFixed(1) : '0.0';

      let statusClass, statusText;
      if (p.quantity === 0) {
        statusClass = 'badge-danger';
        statusText = 'Sem Estoque';
      } else if (p.quantity <= p.minStock) {
        statusClass = 'badge-warning';
        statusText = 'Estoque Baixo';
      } else {
        statusClass = 'badge-success';
        statusText = 'Em Estoque';
      }

      return `
        <tr>
          <td><strong style="color:var(--text-dim);font-size:0.8rem;">${p.code}</strong></td>
          <td>
            <div style="font-weight:600;color:var(--text-main);">${p.name}</div>
            ${p.description ? `<div style="font-size:0.75rem;color:var(--text-dim);margin-top:2px;">${p.description}</div>` : ''}
          </td>
          <td>${p.category}</td>
          <td style="text-align:center;font-weight:600;color:${p.quantity === 0 ? 'var(--accent-rose)' : p.quantity <= p.minStock ? 'var(--accent-amber)' : 'var(--text-secondary)'};">${p.quantity}</td>
          <td>${this.formatCurrency(p.costPrice)}</td>
          <td style="font-weight:600;">${this.formatCurrency(p.sellPrice)}</td>
          <td style="color:${taxRate > 0 ? 'var(--accent-amber)' : 'var(--text-dim)'};">${taxRate > 0 ? taxRate + '%' : '0%'}</td>
          <td style="font-weight:600;color:${parseFloat(margin) >= 30 ? 'var(--accent-emerald)' : parseFloat(margin) >= 15 ? 'var(--accent-amber)' : 'var(--accent-rose)'};">${this.formatCurrency(netUnitProfit)} (${margin}%)</td>
          <td><span class="badge ${statusClass}">${statusText}</span></td>
          <td>
            <div class="actions-cell">
              <button class="btn-icon view btn-view-access-data" data-id="${p.id}" title="${p.accessData ? 'Ver Dados/Chaves' : 'Sem Dados Cadastrados'}" style="color:${p.accessData ? 'var(--accent-blue)' : 'var(--text-dim)'};">
                <i data-lucide="key" style="width:16px;height:16px;"></i>
              </button>
              <button class="btn-icon edit btn-edit" data-id="${p.id}" title="Editar">
                <i data-lucide="edit-2" style="width:16px;height:16px;"></i>
              </button>
              <button class="btn-icon delete btn-delete" data-id="${p.id}" title="Excluir">
                <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    this.refreshIcons();
  }

  openProductModal(id = null) {
    const modal = document.getElementById('product-modal');
    const title = document.getElementById('product-modal-title');
    const form = document.getElementById('product-form');
    const idField = document.getElementById('product-id');

    form.reset();
    idField.value = '';

    if (id) {
      const p = this.products.find(x => x.id === id);
      if (p) {
        title.textContent = 'Editar Produto';
        idField.value = p.id;
        document.getElementById('product-name').value = p.name;
        document.getElementById('product-category').value = p.category;
        document.getElementById('product-stock').value = p.quantity;
        document.getElementById('product-min-stock').value = p.minStock;
        document.getElementById('product-cost-price').value = p.costPrice;
        document.getElementById('product-sell-price').value = p.sellPrice;
        document.getElementById('product-tax-rate').value = p.taxRate || 0;
        document.getElementById('product-description').value = p.description || '';
        document.getElementById('product-access-data').value = p.accessData || '';
      }
    } else {
      title.textContent = 'Novo Produto';
      document.getElementById('product-tax-rate').value = 0;
      document.getElementById('product-access-data').value = '';
    }

    modal.classList.remove('hidden');
    this.refreshIcons();
  }

  handleProductSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('product-id').value;
    const name = document.getElementById('product-name').value.trim();
    const category = document.getElementById('product-category').value;
    const quantity = parseInt(document.getElementById('product-stock').value) || 0;
    const minStock = parseInt(document.getElementById('product-min-stock').value) || 0;
    const costPrice = parseFloat(document.getElementById('product-cost-price').value) || 0;
    const sellPrice = parseFloat(document.getElementById('product-sell-price').value) || 0;
    const taxRate = parseFloat(document.getElementById('product-tax-rate').value) || 0;
    const description = document.getElementById('product-description').value.trim();
    const accessData = document.getElementById('product-access-data').value.trim();

    // Validation
    if (!name) return this.showToast('Nome do produto é obrigatório.', 'error');
    if (costPrice <= 0) return this.showToast('Preço de custo deve ser maior que zero.', 'error');
    if (sellPrice <= 0) return this.showToast('Preço de venda deve ser maior que zero.', 'error');
    if (taxRate < 0 || taxRate > 100) return this.showToast('Taxa deve ser entre 0 e 100%.', 'error');
    if (sellPrice <= costPrice) this.showToast('Atenção: preço de venda igual ou menor que o custo.', 'warning');

    const now = new Date().toISOString();

    if (id) {
      // Update
      const index = this.products.findIndex(p => p.id === id);
      if (index !== -1) {
        this.products[index] = {
          ...this.products[index],
          name, category, quantity, minStock, costPrice, sellPrice, taxRate, description, accessData,
          updatedAt: now
        };
        this.showToast('Produto atualizado com sucesso!', 'success');
      }
    } else {
      // Create
      this.products.push({
        id: this.generateId(),
        code: this.generateCode(),
        name, category, quantity, minStock, costPrice, sellPrice, taxRate, description, accessData,
        createdAt: now,
        updatedAt: now
      });
      this.showToast('Produto adicionado com sucesso!', 'success');
    }

    this.saveData();
    this.closeModal('product-modal');
    this.renderProductsTable();
  }

  openDeleteModal(id) {
    const product = this.products.find(p => p.id === id);
    if (!product) return;

    this.deleteTargetId = id;
    const nameEl = document.getElementById('delete-item-name');
    if (nameEl) nameEl.textContent = product.name;

    const modal = document.getElementById('delete-modal');
    modal.classList.remove('hidden');
    this.refreshIcons();
  }

  executeDelete() {
    if (!this.deleteTargetId) return;

    this.products = this.products.filter(p => p.id !== this.deleteTargetId);
    this.deleteTargetId = null;

    this.saveData();
    this.closeModal('delete-modal');
    this.renderProductsTable();
    this.showToast('Produto excluído com sucesso.', 'success');
  }

  openClearModal() {
    const modal = document.getElementById('clear-modal');
    if (modal) {
      modal.classList.remove('hidden');
      this.refreshIcons();
    }
  }

  executeClearAll() {
    this.products = [];
    this.sales = [];
    this.rentalProducts = [];
    this.rentals = [];
    this.loans = [];
    this.saveData();
    this.closeModal('clear-modal');
    this.renderCurrentSection();
    this.showToast('Todos os dados foram limpos.', 'success');
  }

  // ============ ACCESS DATA & REFUNDS ============

  openAccessDataModal(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    const nameEl = document.getElementById('access-modal-product-name');
    const contentEl = document.getElementById('access-modal-content');
    if (nameEl) nameEl.textContent = product.name;
    if (contentEl) contentEl.value = product.accessData || 'Nenhuma informação ou chave cadastrada para este produto.';

    const modal = document.getElementById('access-data-modal');
    if (modal) modal.classList.remove('hidden');
    this.refreshIcons();
  }

  openSaleAccessModal(saleId) {
    const sale = this.sales.find(s => s.id === saleId);
    if (!sale) return;

    const nameEl = document.getElementById('access-modal-product-name');
    const contentEl = document.getElementById('access-modal-content');
    if (nameEl) nameEl.textContent = `${sale.productName} (Venda de ${this.formatDate(sale.date)})`;
    if (contentEl) contentEl.value = sale.accessData || 'Nenhuma informação ou chave registrada para esta venda.';

    const modal = document.getElementById('access-data-modal');
    if (modal) modal.classList.remove('hidden');
    this.refreshIcons();
  }

  copyAccessDataToClipboard() {
    const contentEl = document.getElementById('access-modal-content');
    if (!contentEl || !contentEl.value) return;

    navigator.clipboard.writeText(contentEl.value)
      .then(() => this.showToast('Dados copiados para a área de transferência!', 'success'))
      .catch(() => this.showToast('Erro ao copiar dados.', 'error'));
  }

  openRefundModal(saleId) {
    const sale = this.sales.find(s => s.id === saleId);
    if (!sale || sale.status === 'refunded') return;

    this.refundTargetId = saleId;

    const nameEl = document.getElementById('refund-item-name');
    if (nameEl) nameEl.textContent = `${sale.quantity}x ${sale.productName} (${this.formatCurrency(sale.total)})`;

    const returnStockInput = document.getElementById('refund-return-stock');
    if (returnStockInput) returnStockInput.checked = true;

    const modal = document.getElementById('refund-modal');
    if (modal) modal.classList.remove('hidden');
    this.refreshIcons();
  }

  executeRefund() {
    if (!this.refundTargetId) return;

    const saleIndex = this.sales.findIndex(s => s.id === this.refundTargetId);
    if (saleIndex === -1) return;

    const sale = this.sales[saleIndex];
    sale.status = 'refunded';
    sale.refundedAt = new Date().toISOString();

    const returnStock = document.getElementById('refund-return-stock')?.checked;
    if (returnStock) {
      const productIndex = this.products.findIndex(p => p.id === sale.productId);
      if (productIndex !== -1) {
        this.products[productIndex].quantity += sale.quantity;
        this.products[productIndex].updatedAt = new Date().toISOString();
      }
    }

    this.refundTargetId = null;
    this.saveData();
    this.closeModal('refund-modal');
    this.renderCurrentSection();
    this.showToast('Venda reembolsada com sucesso.', 'success');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
  }

  // ============ SALES ============

  renderSalesSection() {
    this.populateSaleProductSelect();
    this.renderSalesHistory();
    this.updateSalePreview();
  }

  populateSaleProductSelect() {
    const select = document.getElementById('sale-product');
    if (!select) return;

    const currentVal = select.value;
    select.innerHTML = '<option value="" disabled selected>Selecione um produto</option>';

    const available = this.products
      .filter(p => p.quantity > 0)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    available.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.code} - ${p.name} (Est: ${p.quantity} | ${this.formatCurrency(p.sellPrice)})`;
      if (p.id === currentVal) opt.selected = true;
      select.appendChild(opt);
    });
  }

  updateSalePreview() {
    const productId = document.getElementById('sale-product')?.value;
    const qty = parseInt(document.getElementById('sale-quantity')?.value) || 0;
    const discount = parseFloat(document.getElementById('sale-discount')?.value) || 0;
    const taxRate = parseFloat(document.getElementById('sale-tax-rate')?.value) || 0;

    const product = this.products.find(p => p.id === productId);

    let subtotal = 0;
    let discountAmount = 0;
    let total = 0;
    let feeAmount = 0;

    if (product && qty > 0) {
      subtotal = product.sellPrice * qty;
      discountAmount = subtotal * (discount / 100);
      total = subtotal - discountAmount;
      feeAmount = total * (taxRate / 100);
    }

    const elSubtotal = document.getElementById('sale-subtotal');
    const elDiscount = document.getElementById('sale-discount-val');
    const elFee = document.getElementById('sale-fee-val');
    const elTotal = document.getElementById('sale-total');

    if (elSubtotal) elSubtotal.textContent = this.formatCurrency(subtotal);
    if (elDiscount) elDiscount.textContent = '- ' + this.formatCurrency(discountAmount);
    if (elFee) elFee.textContent = '- ' + this.formatCurrency(feeAmount);
    if (elTotal) elTotal.textContent = this.formatCurrency(total);
  }

  handleSaleSubmit(e) {
    e.preventDefault();

    const productId = document.getElementById('sale-product').value;
    const qty = parseInt(document.getElementById('sale-quantity').value) || 0;
    const discount = parseFloat(document.getElementById('sale-discount').value) || 0;
    const taxRate = parseFloat(document.getElementById('sale-tax-rate').value) || 0;

    if (!productId) return this.showToast('Selecione um produto.', 'error');
    if (qty <= 0) return this.showToast('Quantidade deve ser maior que zero.', 'error');
    if (discount < 0 || discount > 100) return this.showToast('Desconto deve ser entre 0 e 100%.', 'error');
    if (taxRate < 0 || taxRate > 100) return this.showToast('Taxa deve ser entre 0 e 100%.', 'error');

    const productIndex = this.products.findIndex(p => p.id === productId);
    if (productIndex === -1) return this.showToast('Produto não encontrado.', 'error');

    const product = this.products[productIndex];

    if (qty > product.quantity) {
      return this.showToast(`Estoque insuficiente. Disponível: ${product.quantity} un.`, 'error');
    }

    // Create sale
    const sale = this.createSaleRecord(product, qty, discount, new Date().toISOString(), taxRate);
    this.sales.unshift(sale);

    // Decrease stock
    this.products[productIndex].quantity -= qty;
    this.products[productIndex].updatedAt = new Date().toISOString();

    this.saveData();
    this.showToast(`Venda registrada! Lucro: ${this.formatCurrency(sale.profit)}`, 'success');

    // Reset form
    document.getElementById('new-sale-form').reset();
    this.updateSalePreview();
    this.populateSaleProductSelect();
    this.renderSalesHistory();
  }

  renderSalesHistory(searchTerm = '') {
    const tbody = document.getElementById('sales-table-body');
    if (!tbody) return;

    let filtered = [...this.sales];

    if (searchTerm) {
      filtered = filtered.filter(s =>
        s.productName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-state">Nenhuma venda registrada.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(s => {
      const isRefunded = s.status === 'refunded';
      const hasAccessData = !!s.accessData;

      return `
        <tr style="${isRefunded ? 'opacity:0.6;background:rgba(244,63,94,0.03);' : ''}">
          <td style="white-space:nowrap;">
            ${this.formatDate(s.date)}
            ${isRefunded ? '<br><span class="badge badge-danger" style="font-size:0.65rem;margin-top:3px;display:inline-block;">Reembolsado</span>' : ''}
          </td>
          <td style="font-weight:600;color:var(--text-main);">${s.productName}</td>
          <td style="text-align:center;">${s.quantity}</td>
          <td>${this.formatCurrency(s.unitPrice)}</td>
          <td style="text-align:center;color:${s.discount > 0 ? 'var(--accent-amber)' : 'var(--text-dim)'};">${s.discount > 0 ? s.discount + '%' : '—'}</td>
          <td style="text-align:center;color:${(s.fee || 0) > 0 ? 'var(--accent-amber)' : 'var(--text-dim)'};">${(s.fee || 0) > 0 ? s.fee + '% (' + this.formatCurrency(s.feeAmount || 0) + ')' : '—'}</td>
          <td style="font-weight:600;${isRefunded ? 'text-decoration:line-through;color:var(--text-dim);' : ''}">${this.formatCurrency(s.total)}</td>
          <td style="font-weight:600;color:${isRefunded ? 'var(--text-dim)' : s.profit >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)'};${isRefunded ? 'text-decoration:line-through;' : ''}">${this.formatCurrency(s.profit)}</td>
          <td>
            <div class="actions-cell">
              ${hasAccessData ? `
                <button class="btn-icon edit btn-view-sale-access" data-id="${s.id}" title="Ver Chaves / Dados de Acesso" style="color:var(--accent-blue);">
                  <i data-lucide="key" style="width:16px;height:16px;"></i>
                </button>
              ` : ''}
              ${!isRefunded ? `
                <button class="btn-icon delete btn-refund" data-id="${s.id}" title="Reembolsar Venda" style="color:var(--accent-rose);">
                  <i data-lucide="rotate-ccw" style="width:16px;height:16px;"></i>
                </button>
              ` : '<span style="font-size:0.75rem;color:var(--accent-rose);font-weight:600;">Reembolsado</span>'}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // ============ REPORTS ============

  renderReports() {
    const startInput = document.getElementById('report-date-start');
    const endInput = document.getElementById('report-date-end');

    // Default to last 30 days
    if (startInput && !startInput.value) {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      startInput.value = d.toISOString().split('T')[0];
    }
    if (endInput && !endInput.value) {
      endInput.value = new Date().toISOString().split('T')[0];
    }

    let startDate = startInput ? new Date(startInput.value + 'T00:00:00') : new Date(0);
    let endDate = endInput ? new Date(endInput.value + 'T23:59:59') : new Date();

    // Filter sales
    const filtered = this.sales.filter(s => {
      if (s.status === 'refunded') return false;
      const d = new Date(s.date);
      return d >= startDate && d <= endDate;
    });

    // Calculate totals
    let totalRevenue = 0;
    let totalCost = 0;
    let totalFees = 0;

    filtered.forEach(s => {
      totalRevenue += s.total;
      totalCost += s.costPrice * s.quantity;
      totalFees += s.feeAmount || (s.total * ((s.fee || 0) / 100));
    });

    const netProfit = totalRevenue - totalCost - totalFees;

    // Update summary cards
    const elRevenue = document.getElementById('report-total-revenue');
    const elCost = document.getElementById('report-total-cost');
    const elFees = document.getElementById('report-total-fees');
    const elProfit = document.getElementById('report-net-profit');

    if (elRevenue) elRevenue.textContent = this.formatCurrency(totalRevenue);
    if (elCost) elCost.textContent = this.formatCurrency(totalCost);
    if (elFees) elFees.textContent = this.formatCurrency(totalFees);
    if (elProfit) {
      elProfit.textContent = this.formatCurrency(netProfit);
      elProfit.style.color = netProfit >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)';
    }

    this.renderProfitChart(filtered, startDate, endDate);
    this.renderProductProfitability(filtered);
  }

  renderProfitChart(sales, startDate, endDate) {
    const canvas = document.getElementById('profitChart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (this.charts.profit) this.charts.profit.destroy();

    // Group by day
    const dailyData = {};
    const diffDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

    if (diffDays <= 31) {
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        dailyData[d.toLocaleDateString('pt-BR')] = { revenue: 0, profit: 0 };
      }
    }

    sales.forEach(s => {
      const key = new Date(s.date).toLocaleDateString('pt-BR');
      if (!dailyData[key]) dailyData[key] = { revenue: 0, profit: 0 };
      dailyData[key].revenue += s.total;
      dailyData[key].profit += s.profit;
    });

    const sortedKeys = Object.keys(dailyData).sort((a, b) => {
      const [da, ma, ya] = a.split('/');
      const [db, mb, yb] = b.split('/');
      return new Date(ya, ma - 1, da) - new Date(yb, mb - 1, db);
    });

    const labels = sortedKeys.map(k => k.substring(0, 5));

    this.charts.profit = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Receita (R$)',
            data: sortedKeys.map(k => dailyData[k].revenue),
            backgroundColor: 'rgba(139, 92, 246, 0.7)',
            borderRadius: 6
          },
          {
            label: 'Lucro (R$)',
            data: sortedKeys.map(k => dailyData[k].profit),
            backgroundColor: 'rgba(16, 185, 129, 0.7)',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => ctx.dataset.label + ': R$ ' + ctx.parsed.y.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(148, 163, 184, 0.08)' },
            ticks: { callback: v => 'R$ ' + v.toLocaleString('pt-BR') }
          },
          x: { grid: { display: false } }
        }
      }
    });
  }

  renderProductProfitability(sales) {
    const tbody = document.getElementById('product-profitability-table-body');
    if (!tbody) return;

    const stats = {};

    sales.forEach(s => {
      if (!stats[s.productId]) {
        stats[s.productId] = { name: s.productName, qty: 0, revenue: 0, cost: 0, fees: 0 };
      }
      stats[s.productId].qty += s.quantity;
      stats[s.productId].revenue += s.total;
      stats[s.productId].cost += s.costPrice * s.quantity;
      stats[s.productId].fees += s.feeAmount || (s.total * ((s.fee || 0) / 100));
    });

    const arr = Object.values(stats).sort((a, b) => (b.revenue - b.cost - b.fees) - (a.revenue - a.cost - a.fees));

    if (arr.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum dado para o período selecionado.</td></tr>';
      return;
    }

    tbody.innerHTML = arr.map(s => {
      const profit = s.revenue - s.cost - s.fees;
      const margin = s.revenue > 0 ? ((profit / s.revenue) * 100).toFixed(1) : '0.0';

      return `
        <tr>
          <td style="font-weight:600;color:var(--text-main);">${s.name}</td>
          <td style="text-align:center;">${s.qty}</td>
          <td>${this.formatCurrency(s.revenue)}</td>
          <td style="color:var(--accent-amber);">${this.formatCurrency(s.fees)}</td>
          <td style="font-weight:600;color:${profit >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)'};">${this.formatCurrency(profit)}</td>
          <td style="color:${parseFloat(margin) >= 25 ? 'var(--accent-emerald)' : 'var(--accent-amber)'};">${margin}%</td>
        </tr>
      `;
    }).join('');
  }

  // ============ SEARCH ============

  handleSearch(term) {
    if (this.currentSection === 'products') {
      this.renderProductsTable(term);
    } else if (this.currentSection === 'sales') {
      this.renderSalesHistory(term);
    } else if (term.length >= 2) {
      this.navigateTo('products');
      setTimeout(() => this.renderProductsTable(term), 50);
    }
  }

  // ============ TOAST NOTIFICATIONS ============

  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
      success: 'check-circle',
      error: 'alert-circle',
      warning: 'alert-triangle'
    };

    toast.innerHTML = `
      <i data-lucide="${icons[type] || 'info'}" class="toast-icon"></i>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    this.refreshIcons();

    // Auto remove after 3.5s
    setTimeout(() => {
      toast.classList.add('hiding');
      setTimeout(() => {
        if (container.contains(toast)) container.removeChild(toast);
      }, 300);
    }, 3500);
  }

  // ============ ANIMATION HELPERS ============

  animateValue(el, endValue) {
    const duration = 800;
    let start = null;
    const startVal = parseInt(el.textContent) || 0;

    const step = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(startVal + (endValue - startVal) * ease);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  animateCurrency(el, endValue) {
    const duration = 900;
    let start = null;

    const step = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      el.textContent = this.formatCurrency(endValue * ease);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ============ RENTAL SECTION ============

  renderRentalSection() {
    this.renderRentalProductsTable();
    this.renderRentalsTable();
    this.populateRentalProductSelect();
  }

  renderRentalProductsTable() {
    const tbody = document.getElementById('rental-products-table-body');
    if (!tbody) return;

    if (this.rentalProducts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-state">Nenhum item alugável cadastrado.</td></tr>';
      return;
    }

    tbody.innerHTML = this.rentalProducts.map(p => {
      const isAvailable = p.quantity > 0;
      const statusBadge = isAvailable
        ? `<span class="badge badge-success">${p.quantity} Disp.</span>`
        : `<span class="badge badge-danger">Indisponível</span>`;

      return `
        <tr>
          <td style="font-weight:600;color:var(--text-main);">${p.name}</td>
          <td>${p.category}</td>
          <td style="text-align:center;">${statusBadge}</td>
          <td>${this.formatCurrency(p.investment || 0)}</td>
          <td>${p.dailyRate > 0 ? this.formatCurrency(p.dailyRate) : '—'}</td>
          <td style="font-weight:600;color:var(--accent-emerald);">${p.weeklyRate > 0 ? this.formatCurrency(p.weeklyRate) : '—'}</td>
          <td style="font-weight:600;color:var(--accent-blue);">${p.monthlyRate > 0 ? this.formatCurrency(p.monthlyRate) : '—'}</td>
          <td>
            <button class="btn-icon view btn-view-rental-product-access" data-id="${p.id}" title="${p.accessData ? 'Ver Dados/Chaves' : 'Sem Dados Cadastrados'}" style="color:${p.accessData ? 'var(--accent-blue)' : 'var(--text-dim)'};">
              <i data-lucide="key" style="width:16px;height:16px;"></i>
            </button>
          </td>
          <td>
            <div class="actions-cell">
              <button class="btn-icon edit btn-edit-rental-product" data-id="${p.id}" title="Editar">
                <i data-lucide="edit-2" style="width:16px;height:16px;"></i>
              </button>
              <button class="btn-icon delete btn-delete-rental-product" data-id="${p.id}" title="Excluir">
                <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    this.refreshIcons();
  }

  renderRentalsTable() {
    const tbody = document.getElementById('rentals-table-body');
    if (!tbody) return;

    const filter = document.getElementById('rental-status-filter')?.value || 'all';
    const now = new Date();

    let filtered = [...this.rentals];

    // Compute status on the fly
    filtered.forEach(r => {
      if (r.status !== 'closed') {
        const endDate = new Date(r.endDate + 'T23:59:59');
        if (endDate < now) {
          r.computedStatus = 'expired';
        } else {
          r.computedStatus = 'active';
        }
      } else {
        r.computedStatus = 'closed';
      }
    });

    if (filter !== 'all') {
      filtered = filtered.filter(r => r.computedStatus === filter);
    }

    filtered.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Nenhum aluguel encontrado.</td></tr>';
      return;
    }

    const unitLabels = { day: 'Dia(s)', week: 'Semana(s)', month: 'Mês/Meses' };

    tbody.innerHTML = filtered.map(r => {
      let badgeHtml;
      if (r.computedStatus === 'active') {
        badgeHtml = '<span class="badge badge-success">Ativo</span>';
      } else if (r.computedStatus === 'expired') {
        badgeHtml = '<span class="badge badge-danger">Vencido</span>';
      } else {
        badgeHtml = '<span class="badge badge-secondary" style="background:rgba(255,255,255,0.08);color:var(--text-muted);">Encerrado</span>';
      }

      const hasAccess = !!r.accessData;
      const isClosed = r.computedStatus === 'closed';

      return `
        <tr style="${r.computedStatus === 'expired' ? 'background:rgba(244,63,94,0.04);' : isClosed ? 'opacity:0.65;' : ''}">
          <td style="font-weight:600;color:var(--text-main);">${r.productName}</td>
          <td>${r.client}</td>
          <td>${r.duration} ${unitLabels[r.durationUnit] || r.durationUnit}</td>
          <td>${this.formatShortDate(r.startDate)}</td>
          <td style="font-weight:600;color:${r.computedStatus === 'expired' ? 'var(--accent-rose)' : 'inherit'};">${this.formatShortDate(r.endDate)}</td>
          <td style="font-weight:600;color:var(--accent-emerald);">${this.formatCurrency(r.totalCharged)}</td>
          <td>${badgeHtml}</td>
          <td>
            <div class="actions-cell">
              ${hasAccess ? `
                <button class="btn-icon edit btn-view-rental-access" data-id="${r.id}" title="Ver Chaves / Dados de Acesso" style="color:var(--accent-blue);">
                  <i data-lucide="key" style="width:16px;height:16px;"></i>
                </button>
              ` : ''}
              ${!isClosed ? `
                <button class="btn-icon delete btn-close-rental" data-id="${r.id}" title="Encerrar Aluguel" style="color:var(--accent-amber);">
                  <i data-lucide="stop-circle" style="width:16px;height:16px;"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    this.refreshIcons();
  }

  openRentalProductModal(id = null) {
    const modal = document.getElementById('rental-product-modal');
    const title = document.getElementById('rental-product-modal-title');
    const form = document.getElementById('rental-product-form');
    const idField = document.getElementById('rental-product-id');

    form.reset();
    idField.value = '';

    if (id) {
      const p = this.rentalProducts.find(x => x.id === id);
      if (p) {
        title.textContent = 'Editar Item Alugável';
        idField.value = p.id;
        document.getElementById('rental-product-name').value = p.name;
        document.getElementById('rental-product-category').value = p.category;
        document.getElementById('rental-product-quantity').value = p.quantity;
        document.getElementById('rental-product-investment').value = p.investment || 0;
        document.getElementById('rental-product-daily-rate').value = p.dailyRate || 0;
        document.getElementById('rental-product-weekly-rate').value = p.weeklyRate || 0;
        document.getElementById('rental-product-monthly-rate').value = p.monthlyRate || 0;
        document.getElementById('rental-product-description').value = p.description || '';
        document.getElementById('rental-product-access-data').value = p.accessData || '';
      }
    } else {
      title.textContent = 'Cadastrar Item Alugável';
      document.getElementById('rental-product-quantity').value = 1;
      document.getElementById('rental-product-investment').value = 0;
      document.getElementById('rental-product-daily-rate').value = 0;
      document.getElementById('rental-product-weekly-rate').value = 0;
      document.getElementById('rental-product-monthly-rate').value = 0;
      document.getElementById('rental-product-access-data').value = '';
    }

    modal.classList.remove('hidden');
    this.refreshIcons();
  }

  handleRentalProductSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('rental-product-id').value;
    const name = document.getElementById('rental-product-name').value.trim();
    const category = document.getElementById('rental-product-category').value;
    const quantity = parseInt(document.getElementById('rental-product-quantity').value) || 0;
    const investment = parseFloat(document.getElementById('rental-product-investment').value) || 0;
    const dailyRate = parseFloat(document.getElementById('rental-product-daily-rate').value) || 0;
    const weeklyRate = parseFloat(document.getElementById('rental-product-weekly-rate').value) || 0;
    const monthlyRate = parseFloat(document.getElementById('rental-product-monthly-rate').value) || 0;
    const description = document.getElementById('rental-product-description').value.trim();
    const accessData = document.getElementById('rental-product-access-data').value.trim();

    if (!name) return this.showToast('Nome do item é obrigatório.', 'error');
    if (quantity < 0) return this.showToast('Quantidade inválida.', 'error');

    const now = new Date().toISOString();

    if (id) {
      const index = this.rentalProducts.findIndex(p => p.id === id);
      if (index !== -1) {
        this.rentalProducts[index] = {
          ...this.rentalProducts[index],
          name, category, quantity, investment, dailyRate, weeklyRate, monthlyRate, description, accessData,
          updatedAt: now
        };
        this.showToast('Item alugável atualizado!', 'success');
      }
    } else {
      this.rentalProducts.push({
        id: this.generateId(),
        name, category, quantity, investment, dailyRate, weeklyRate, monthlyRate, description, accessData,
        createdAt: now,
        updatedAt: now
      });
      this.showToast('Item alugável cadastrado!', 'success');
    }

    this.saveData();
    this.closeModal('rental-product-modal');
    this.renderRentalProductsTable();
    this.populateRentalProductSelect();
  }

  deleteRentalProduct(id) {
    const p = this.rentalProducts.find(x => x.id === id);
    if (!p) return;
    if (!confirm(`Tem certeza que deseja excluir o item alugável "${p.name}"?`)) return;

    this.rentalProducts = this.rentalProducts.filter(x => x.id !== id);
    this.saveData();
    this.renderRentalProductsTable();
    this.populateRentalProductSelect();
    this.showToast('Item alugável excluído.', 'success');
  }

  populateRentalProductSelect() {
    const select = document.getElementById('rental-product-select');
    if (!select) return;

    const available = this.rentalProducts.filter(p => p.quantity > 0);

    select.innerHTML = '<option value="" disabled selected>Selecione um item</option>' +
      available.map(p => `<option value="${p.id}">${p.name} (${p.quantity} disp.)</option>`).join('');
  }

  openRentalModal() {
    this.populateRentalProductSelect();
    const modal = document.getElementById('rental-modal');
    const form = document.getElementById('rental-form');
    form.reset();

    const todayStr = new Date().toISOString().split('T')[0];
    document.getElementById('rental-start-date').value = todayStr;
    document.getElementById('rental-duration').value = 1;
    document.getElementById('rental-duration-unit').value = 'week';

    this.updateRentalPreview();

    modal.classList.remove('hidden');
    this.refreshIcons();
  }

  updateRentalPreview() {
    const productId = document.getElementById('rental-product-select')?.value;
    const duration = parseInt(document.getElementById('rental-duration')?.value) || 1;
    const unit = document.getElementById('rental-duration-unit')?.value || 'week';
    const startDateInput = document.getElementById('rental-start-date');
    const endDateInput = document.getElementById('rental-end-date');
    const totalInput = document.getElementById('rental-total-charged');

    const startDateStr = startDateInput?.value || new Date().toISOString().split('T')[0];
    const startDate = new Date(startDateStr + 'T00:00:00');

    // Calculate end date
    const endDate = new Date(startDate);
    if (unit === 'day') {
      endDate.setDate(endDate.getDate() + duration);
    } else if (unit === 'week') {
      endDate.setDate(endDate.getDate() + (duration * 7));
    } else if (unit === 'month') {
      endDate.setMonth(endDate.getMonth() + duration);
    }

    if (endDateInput) {
      endDateInput.value = endDate.toISOString().split('T')[0];
    }

    // Auto-calculate suggested rate & total
    const product = this.rentalProducts.find(p => p.id === productId);
    let rate = 0;
    if (product) {
      if (unit === 'day') rate = product.dailyRate || (product.weeklyRate ? product.weeklyRate / 7 : 0);
      else if (unit === 'week') rate = product.weeklyRate || (product.dailyRate ? product.dailyRate * 7 : 0);
      else if (unit === 'month') rate = product.monthlyRate || (product.weeklyRate ? product.weeklyRate * 4 : 0);
    }

    const calculatedTotal = rate * duration;
    if (totalInput) {
      totalInput.value = calculatedTotal > 0 ? calculatedTotal.toFixed(2) : '';
    }

    const previewRate = document.getElementById('rental-preview-rate');
    const previewTotal = document.getElementById('rental-preview-total');
    if (previewRate) previewRate.textContent = `${this.formatCurrency(rate)} / ${unit === 'day' ? 'dia' : unit === 'week' ? 'semana' : 'mês'}`;
    if (previewTotal) previewTotal.textContent = this.formatCurrency(parseFloat(totalInput?.value) || calculatedTotal);
  }

  handleRentalSubmit(e) {
    e.preventDefault();

    const productId = document.getElementById('rental-product-select').value;
    const client = document.getElementById('rental-client').value.trim();
    const duration = parseInt(document.getElementById('rental-duration').value) || 1;
    const durationUnit = document.getElementById('rental-duration-unit').value;
    const startDate = document.getElementById('rental-start-date').value;
    const endDate = document.getElementById('rental-end-date').value;
    const totalCharged = parseFloat(document.getElementById('rental-total-charged').value) || 0;
    const notes = document.getElementById('rental-notes').value.trim();

    if (!productId) return this.showToast('Selecione um item.', 'error');
    if (!client) return this.showToast('Informe o cliente.', 'error');
    if (!startDate || !endDate) return this.showToast('Informe as datas.', 'error');

    const productIndex = this.rentalProducts.findIndex(p => p.id === productId);
    if (productIndex === -1 || this.rentalProducts[productIndex].quantity <= 0) {
      return this.showToast('Item não disponível em estoque.', 'error');
    }

    const product = this.rentalProducts[productIndex];

    const rentalRecord = {
      id: this.generateId(),
      productId: product.id,
      productName: product.name,
      client,
      duration,
      durationUnit,
      startDate,
      endDate,
      totalCharged,
      notes,
      accessData: product.accessData || '',
      status: 'active',
      createdAt: new Date().toISOString()
    };

    // Decrease stock
    this.rentalProducts[productIndex].quantity -= 1;
    this.rentalProducts[productIndex].updatedAt = new Date().toISOString();

    this.rentals.unshift(rentalRecord);
    this.saveData();
    this.closeModal('rental-modal');
    this.renderRentalSection();
    this.showToast(`Aluguel registrado! Total: ${this.formatCurrency(totalCharged)}`, 'success');
  }

  openCloseRentalModal(id) {
    const rental = this.rentals.find(r => r.id === id);
    if (!rental || rental.status === 'closed') return;

    this.closeRentalTargetId = id;
    const nameEl = document.getElementById('close-rental-item-name');
    if (nameEl) nameEl.textContent = `${rental.productName} (Cliente: ${rental.client})`;

    const returnStockCheckbox = document.getElementById('rental-return-stock');
    if (returnStockCheckbox) returnStockCheckbox.checked = true;

    const modal = document.getElementById('close-rental-modal');
    if (modal) modal.classList.remove('hidden');
    this.refreshIcons();
  }

  executeCloseRental() {
    if (!this.closeRentalTargetId) return;

    const rental = this.rentals.find(r => r.id === this.closeRentalTargetId);
    if (!rental) return;

    rental.status = 'closed';
    rental.closedAt = new Date().toISOString();

    const returnStock = document.getElementById('rental-return-stock')?.checked;
    if (returnStock) {
      const productIndex = this.rentalProducts.findIndex(p => p.id === rental.productId);
      if (productIndex !== -1) {
        this.rentalProducts[productIndex].quantity += 1;
        this.rentalProducts[productIndex].updatedAt = new Date().toISOString();
      }
    }

    this.closeRentalTargetId = null;
    this.saveData();
    this.closeModal('close-rental-modal');
    this.renderRentalSection();
    this.showToast('Aluguel encerrado.', 'success');
  }

  openRentalProductAccessModal(productId) {
    const product = this.rentalProducts.find(p => p.id === productId);
    if (!product) return;

    const nameEl = document.getElementById('access-modal-product-name');
    const contentEl = document.getElementById('access-modal-content');
    if (nameEl) nameEl.textContent = product.name;
    if (contentEl) contentEl.value = product.accessData || 'Nenhuma informação ou chave cadastrada para este item.';

    const modal = document.getElementById('access-data-modal');
    if (modal) modal.classList.remove('hidden');
    this.refreshIcons();
  }

  openRentalAccessModal(rentalId) {
    const rental = this.rentals.find(r => r.id === rentalId);
    if (!rental) return;

    const nameEl = document.getElementById('access-modal-product-name');
    const contentEl = document.getElementById('access-modal-content');
    if (nameEl) nameEl.textContent = `${rental.productName} (Aluguel - ${rental.client})`;
    if (contentEl) contentEl.value = rental.accessData || 'Nenhuma informação ou chave registrada para este aluguel.';

    const modal = document.getElementById('access-data-modal');
    if (modal) modal.classList.remove('hidden');
    this.refreshIcons();
  }

  // ============ LOANS SECTION ============

  renderLoansSection() {
    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    const loanDateInput = document.getElementById('loan-date');
    if (loanDateInput && !loanDateInput.value) loanDateInput.value = today;

    const loanDueDateInput = document.getElementById('loan-due-date');
    if (loanDueDateInput && !loanDueDateInput.value) {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      loanDueDateInput.value = nextMonth.toISOString().split('T')[0];
    }

    this.renderLoansTable();
    this.updateLoanPreview();
  }

  updateLoanPreview() {
    const amount = parseFloat(document.getElementById('loan-amount')?.value) || 0;
    const rate = parseFloat(document.getElementById('loan-interest-rate')?.value) || 0;

    const preview = document.getElementById('loan-preview');
    if (!preview) return;

    if (amount > 0) {
      preview.style.display = 'block';
      const interest = amount * (rate / 100);
      const total = amount + interest;

      document.getElementById('loan-preview-principal').textContent = this.formatCurrency(amount);
      document.getElementById('loan-preview-interest').textContent = rate > 0 ? `+ ${this.formatCurrency(interest)} (${rate}%)` : '+ R$ 0,00 (0%)';
      document.getElementById('loan-preview-total').textContent = this.formatCurrency(total);
    } else {
      preview.style.display = 'none';
    }
  }

  handleLoanSubmit(e) {
    e.preventDefault();

    const borrower = document.getElementById('loan-borrower').value.trim();
    const amount = parseFloat(document.getElementById('loan-amount').value) || 0;
    const interestRate = parseFloat(document.getElementById('loan-interest-rate').value) || 0;
    const loanDate = document.getElementById('loan-date').value;
    const dueDate = document.getElementById('loan-due-date').value;
    const notes = document.getElementById('loan-notes').value.trim();

    if (!borrower) return this.showToast('Informe para quem foi o empréstimo.', 'error');
    if (amount <= 0) return this.showToast('Informe um valor válido.', 'error');
    if (!loanDate || !dueDate) return this.showToast('Informe as datas.', 'error');

    const interestAmount = amount * (interestRate / 100);
    const totalToReceive = amount + interestAmount;

    const loan = {
      id: this.generateId(),
      borrower,
      amount,
      interestRate,
      interestAmount,
      totalToReceive,
      loanDate,
      dueDate,
      notes,
      status: 'open',
      createdAt: new Date().toISOString()
    };

    this.loans.unshift(loan);
    this.saveData();

    document.getElementById('new-loan-form').reset();
    document.getElementById('loan-preview').style.display = 'none';
    this.renderLoansSection();
    this.showToast(`Empréstimo registrado para ${borrower}!`, 'success');
  }

  renderLoansTable() {
    const tbody = document.getElementById('loans-table-body');
    if (!tbody) return;

    const now = new Date();

    // Compute status
    this.loans.forEach(l => {
      if (l.status !== 'returned') {
        const dueDate = new Date(l.dueDate + 'T23:59:59');
        if (dueDate < now) {
          l.computedStatus = 'overdue';
        } else {
          l.computedStatus = 'open';
        }
      } else {
        l.computedStatus = 'returned';
      }
    });

    let totalRemainingOverall = 0;
    let openCount = 0;

    // Compute status and totals for each loan
    this.loans.forEach(l => {
      l.payments = l.payments || [];
      if (l.payments.length > 0) {
        l.amountPaid = l.payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      } else if (l.status === 'returned') {
        l.amountPaid = typeof l.amountReceived === 'number' ? l.amountReceived : l.totalToReceive;
      } else {
        l.amountPaid = l.amountPaid || 0;
      }

      l.remainingAmount = Math.max(0, l.totalToReceive - l.amountPaid);

      if (l.remainingAmount <= 0.001) {
        l.computedStatus = 'returned';
      } else {
        openCount++;
        totalRemainingOverall += l.remainingAmount;
        const dueDate = new Date(l.dueDate + 'T23:59:59');
        if (dueDate < now) {
          l.computedStatus = 'overdue';
        } else if (l.amountPaid > 0) {
          l.computedStatus = 'partial';
        } else {
          l.computedStatus = 'open';
        }
      }
    });

    const badge = document.getElementById('loans-open-badge');
    if (badge) {
      if (openCount > 0) {
        badge.style.display = 'inline-block';
        badge.textContent = `${openCount} em aberto • Saldo Restante: ${this.formatCurrency(totalRemainingOverall)}`;
      } else {
        badge.style.display = 'none';
      }
    }

    if (this.loans.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="empty-state">Nenhum empréstimo registrado.</td></tr>';
      return;
    }

    tbody.innerHTML = this.loans.map(l => {
      let badgeHtml;
      if (l.computedStatus === 'returned') {
        badgeHtml = '<span class="badge badge-success">Quitado</span>';
      } else if (l.computedStatus === 'overdue') {
        badgeHtml = '<span class="badge badge-danger">Vencido</span>';
      } else if (l.computedStatus === 'partial') {
        const pct = Math.min(100, Math.round((l.amountPaid / l.totalToReceive) * 100));
        badgeHtml = `<span class="badge badge-blue">Pago ${pct}%</span>`;
      } else {
        badgeHtml = '<span class="badge badge-warning">Em Aberto</span>';
      }

      const isReturned = l.computedStatus === 'returned';

      return `
        <tr style="${l.computedStatus === 'overdue' ? 'background:rgba(244,63,94,0.04);' : isReturned ? 'opacity:0.65;' : ''}">
          <td>
            <div style="font-weight:600;color:var(--text-main);">${l.borrower}</div>
            ${l.notes ? `<div style="font-size:0.75rem;color:var(--text-dim);margin-top:2px;">${l.notes}</div>` : ''}
          </td>
          <td style="font-weight:600;">${this.formatCurrency(l.amount)}</td>
          <td style="text-align:center;color:${l.interestRate > 0 ? 'var(--accent-amber)' : 'var(--text-dim)'};">${l.interestRate > 0 ? l.interestRate + '%' : '—'}</td>
          <td style="font-weight:600;">${this.formatCurrency(l.totalToReceive)}</td>
          <td style="font-weight:600;color:${l.amountPaid > 0 ? 'var(--accent-emerald)' : 'var(--text-dim)'};">${this.formatCurrency(l.amountPaid || 0)}</td>
          <td style="font-weight:600;color:${l.remainingAmount > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)'};">${this.formatCurrency(l.remainingAmount || 0)}</td>
          <td>${this.formatShortDate(l.loanDate)}</td>
          <td style="font-weight:600;color:${l.computedStatus === 'overdue' ? 'var(--accent-rose)' : 'inherit'};">${this.formatShortDate(l.dueDate)}</td>
          <td>${badgeHtml}</td>
          <td>
            <div class="actions-cell">
              <button class="btn-icon view btn-pay-loan" data-id="${l.id}" title="${isReturned ? 'Ver Histórico de Pagamentos' : 'Pagar / Abater Valor'}" style="color:${isReturned ? 'var(--accent-blue)' : 'var(--accent-emerald)'};">
                <i data-lucide="${isReturned ? 'receipt' : 'hand-coins'}" style="width:16px;height:16px;"></i>
              </button>
              <button class="btn-icon delete btn-delete-loan" data-id="${l.id}" title="Excluir Empréstimo">
                <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    this.refreshIcons();
  }

  openLoanPaymentModal(id) {
    const loan = this.loans.find(l => l.id === id);
    if (!loan) return;

    this.loanPaymentTargetId = id;
    loan.payments = loan.payments || [];

    const amountPaid = loan.payments.length > 0
      ? loan.payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
      : (loan.status === 'returned' ? (loan.amountReceived || loan.totalToReceive) : (loan.amountPaid || 0));

    const remainingAmount = Math.max(0, loan.totalToReceive - amountPaid);

    // Update modal summary numbers
    const borrowerEl = document.getElementById('loan-pay-borrower');
    const totalDueEl = document.getElementById('loan-pay-total-due');
    const alreadyPaidEl = document.getElementById('loan-pay-already-paid');
    const remainingEl = document.getElementById('loan-pay-remaining');

    if (borrowerEl) borrowerEl.textContent = loan.borrower;
    if (totalDueEl) totalDueEl.textContent = this.formatCurrency(loan.totalToReceive);
    if (alreadyPaidEl) alreadyPaidEl.textContent = this.formatCurrency(amountPaid);
    if (remainingEl) remainingEl.textContent = this.formatCurrency(remainingAmount);

    // Form fields
    const amountInput = document.getElementById('loan-payment-amount');
    const dateInput = document.getElementById('loan-payment-date');
    const noteInput = document.getElementById('loan-payment-note');

    if (amountInput) {
      amountInput.value = remainingAmount > 0 ? remainingAmount.toFixed(2) : '';
    }
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    if (noteInput) noteInput.value = '';

    // Render payments history list
    this.renderLoanPaymentsList(loan);

    const modal = document.getElementById('loan-payment-modal');
    if (modal) modal.classList.remove('hidden');
    this.refreshIcons();
  }

  renderLoanPaymentsList(loan) {
    const container = document.getElementById('loan-payments-history-list');
    if (!container) return;

    const payments = loan.payments || [];
    if (payments.length === 0) {
      container.innerHTML = '<div style="font-size:0.8rem;color:var(--text-dim);text-align:center;padding:8px;">Nenhum pagamento registrado ainda.</div>';
      return;
    }

    container.innerHTML = payments.map(p => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:0.85rem;">
        <div>
          <span style="font-weight:600;color:var(--accent-emerald);">${this.formatCurrency(p.amount)}</span>
          <span style="color:var(--text-dim);font-size:0.75rem;margin-left:8px;">${this.formatShortDate(p.date)}</span>
          ${p.note ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">${p.note}</div>` : ''}
        </div>
        <button type="button" class="btn-icon delete btn-delete-payment" data-loan-id="${loan.id}" data-payment-id="${p.id}" title="Remover este pagamento" style="padding:2px;width:24px;height:24px;">
          <i data-lucide="x" style="width:14px;height:14px;"></i>
        </button>
      </div>
    `).join('');

    this.refreshIcons();
  }

  handleLoanPaymentSubmit(e) {
    e.preventDefault();

    if (!this.loanPaymentTargetId) return;
    const loan = this.loans.find(l => l.id === this.loanPaymentTargetId);
    if (!loan) return;

    const paymentAmount = parseFloat(document.getElementById('loan-payment-amount')?.value) || 0;
    const paymentDate = document.getElementById('loan-payment-date')?.value || new Date().toISOString().split('T')[0];
    const paymentNote = document.getElementById('loan-payment-note')?.value.trim() || '';

    if (paymentAmount <= 0) {
      return this.showToast('Informe um valor de pagamento válido.', 'error');
    }

    loan.payments = loan.payments || [];
    loan.payments.push({
      id: this.generateId(),
      amount: paymentAmount,
      date: paymentDate,
      note: paymentNote,
      createdAt: new Date().toISOString()
    });

    loan.amountPaid = loan.payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    loan.remainingAmount = Math.max(0, loan.totalToReceive - loan.amountPaid);

    if (loan.remainingAmount <= 0.001) {
      loan.status = 'returned';
      loan.actualReturnDate = paymentDate;
      loan.returnedAt = new Date().toISOString();
      this.showToast(`Empréstimo de ${loan.borrower} quitado com sucesso!`, 'success');
    } else {
      loan.status = 'partial';
      this.showToast(`Pagamento de ${this.formatCurrency(paymentAmount)} registrado! Saldo restante: ${this.formatCurrency(loan.remainingAmount)}`, 'success');
    }

    this.saveData();
    this.closeModal('loan-payment-modal');
    this.renderLoansTable();
  }

  deleteLoanPayment(loanId, paymentId) {
    const loan = this.loans.find(l => l.id === loanId);
    if (!loan || !loan.payments) return;

    if (!confirm('Deseja remover este registro de pagamento?')) return;

    loan.payments = loan.payments.filter(p => p.id !== paymentId);
    loan.amountPaid = loan.payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    loan.remainingAmount = Math.max(0, loan.totalToReceive - loan.amountPaid);

    if (loan.remainingAmount <= 0.001 && loan.amountPaid > 0) {
      loan.status = 'returned';
    } else if (loan.amountPaid > 0) {
      loan.status = 'partial';
    } else {
      loan.status = 'open';
    }

    this.saveData();
    this.openLoanPaymentModal(loanId);
    this.renderLoansTable();
    this.showToast('Pagamento removido.', 'success');
  }

  deleteLoan(id) {
    const loan = this.loans.find(l => l.id === id);
    if (!loan) return;
    if (!confirm(`Tem certeza que deseja excluir o empréstimo para "${loan.borrower}"?`)) return;

    this.loans = this.loans.filter(l => l.id !== id);
    this.saveData();
    this.renderLoansTable();
    this.showToast('Empréstimo excluído.', 'success');
  }

  formatShortDate(isoOrDateStr) {
    if (!isoOrDateStr) return '—';
    const parts = isoOrDateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(isoOrDateStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  // ============ UTILITY FUNCTIONS ============

  generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  generateCode() {
    let max = 0;
    this.products.forEach(p => {
      const num = parseInt(p.code.replace('PRD-', ''));
      if (!isNaN(num) && num > max) max = num;
    });
    return `PRD-${(max + 1).toString().padStart(3, '0')}`;
  }

  formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  formatDate(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  refreshIcons() {
    if (window.lucide) {
      try { lucide.createIcons(); } catch (e) { /* ignore */ }
    }
  }
}

// ============ BOOTSTRAP ============
document.addEventListener('DOMContentLoaded', () => {
  window.app = new InventoryApp();
});
