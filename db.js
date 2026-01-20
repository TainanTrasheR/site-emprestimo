let db = null;

/* ===============================
   INICIAR BANCO
================================ */
function iniciarBanco() {
  if (db) return;

  const request = indexedDB.open("sistemaEmprestimos", 1);

  request.onupgradeneeded = e => {
    const database = e.target.result;

    if (!database.objectStoreNames.contains("clientes")) {
      database.createObjectStore("clientes", {
        keyPath: "id",
        autoIncrement: true
      });
    }

    if (!database.objectStoreNames.contains("emprestimos")) {
      const store = database.createObjectStore("emprestimos", {
        keyPath: "id",
        autoIncrement: true
      });
      store.createIndex("clienteId", "clienteId", { unique: false });
    }

    if (!database.objectStoreNames.contains("pagamentos")) {
      const store = database.createObjectStore("pagamentos", {
        keyPath: "id",
        autoIncrement: true
      });
      store.createIndex("emprestimoId", "emprestimoId", { unique: false });
    }
  };

  request.onsuccess = e => {
    db = e.target.result;
    document.dispatchEvent(new Event("dbPronto"));
  };

  request.onerror = e => {
    console.error("Erro ao abrir IndexedDB", e);
  };
}

/* ===============================
   CLIENTES
================================ */
function addCliente(cliente) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("clientes", "readwrite");
    const store = tx.objectStore("clientes");

    const req = store.add(cliente);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getCliente(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("clientes", "readonly");
    const store = tx.objectStore("clientes");

    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ===============================
   EMPRÉSTIMOS
================================ */
function addEmprestimo(emprestimo) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("emprestimos", "readwrite");
    const store = tx.objectStore("emprestimos");

    const req = store.add(emprestimo);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getEmprestimos() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("emprestimos", "readonly");
    const store = tx.objectStore("emprestimos");

    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ===============================
   PAGAMENTOS
================================ */
function addPagamento(pagamento) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pagamentos", "readwrite");
    const store = tx.objectStore("pagamentos");

    const req = store.add(pagamento);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getPagamentosPorEmprestimo(emprestimoId) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pagamentos", "readonly");
    const store = tx.objectStore("pagamentos");
    const index = store.index("emprestimoId");

    const req = index.getAll(emprestimoId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ===============================
   EXCLUSÃO COMPLETA
================================ */
async function excluirCliente(clienteId) {
  // buscar empréstimos
  const emprestimos = await new Promise((resolve, reject) => {
    const tx = db.transaction("emprestimos", "readonly");
    const store = tx.objectStore("emprestimos");
    const index = store.index("clienteId");

    const req = index.getAll(clienteId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  // excluir pagamentos e empréstimos
  for (const emp of emprestimos) {
    await new Promise(resolve => {
      const tx = db.transaction(["pagamentos", "emprestimos"], "readwrite");

      const pagStore = tx.objectStore("pagamentos");
      const empStore = tx.objectStore("emprestimos");

      const index = pagStore.index("emprestimoId");
      const req = index.getAllKeys(emp.id);

      req.onsuccess = () => {
        req.result.forEach(k => pagStore.delete(k));
        empStore.delete(emp.id);
        resolve();
      };
    });
  }

  // excluir cliente
  await new Promise(resolve => {
    const tx = db.transaction("clientes", "readwrite");
    tx.objectStore("clientes").delete(clienteId);
    tx.oncomplete = resolve;
  });
}
