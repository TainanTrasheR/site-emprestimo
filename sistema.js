let emprestimoAtual = null;
let filtroAtual = "todos";
let modoRecebimentos = false;

document.addEventListener("dbPronto", carregarTabela);

/* ===============================
   FILTRO STATUS
================================ */
function setFiltro(filtro) {
  filtroAtual = filtro;
  modoRecebimentos = false;
  carregarTabela();
}

/* ===============================
   GERAR PARCELAS
================================ */
function gerarParcelas(total, qtd, primeiroVencimento) {
  const parcelas = [];
  const valor = Number((total / qtd).toFixed(2));
  let data = new Date(primeiroVencimento);

  for (let i = 1; i <= qtd; i++) {
    parcelas.push({
      numero: i,
      valor,
      vencimento: data.toISOString().split("T")[0],
      pago: false
    });
    data.setMonth(data.getMonth() + 1);
  }
  return parcelas;
}

/* ===============================
   TABELA NORMAL
================================ */
async function carregarTabela() {
  if (modoRecebimentos) return;

  const tbody = document.getElementById("tabelaEmprestimos");
  tbody.innerHTML = "";

  let totalEmprestado = 0;
  let totalReceber = 0;
  let totalRecebido = 0;
  let atrasados = 0;

  const emprestimos = await getEmprestimos();
  const hoje = new Date();

  for (const e of emprestimos) {
    if (!e.parcelas) e.parcelas = [];

    const cliente = await getCliente(e.clienteId);
    const pagamentos = await getPagamentosPorEmprestimo(e.id);
    const recebido = pagamentos.reduce((s, p) => s + Number(p.valor), 0);

    totalEmprestado += e.valor;
    totalReceber += e.totalReceber;
    totalRecebido += recebido;

    let status = "Em dia";
    let classe = "em-dia";
    let atrasado = false;

    if (recebido >= e.totalReceber) {
      status = "Quitado";
      classe = "quitado";
    } else if (hoje > new Date(e.vencimento)) {
      status = "Atrasado";
      classe = "atrasado";
      atrasado = true;
      atrasados++;
    }

    if (
      (filtroAtual === "atrasado" && !atrasado) ||
      (filtroAtual === "emdia" && atrasado)
    ) continue;

    tbody.innerHTML += `
      <tr>
        <td>${cliente.nome}</td>
        <td>R$ ${e.valor.toFixed(2)}</td>
        <td>R$ ${e.totalReceber.toFixed(2)}</td>
        <td>R$ ${recebido.toFixed(2)}</td>
        <td>R$ ${(recebido - e.valor).toFixed(2)}</td>
        <td>${formatarData(e.vencimento)}</td>
        <td class="${classe}">${status}</td>
        <td>
          <button onclick="abrirParcelas(${e.id})">📄</button>
          <button onclick="abrirModalPagamento(${e.id})">💰</button>
          <button onclick="confirmarExclusao(${cliente.id})">🗑️</button>
        </td>
      </tr>
    `;
  }

  resumoEmprestado.innerText = `R$ ${totalEmprestado.toFixed(2)}`;
  resumoReceber.innerText = `R$ ${totalReceber.toFixed(2)}`;
  resumoRecebido.innerText = `R$ ${totalRecebido.toFixed(2)}`;
  resumoLucro.innerText = `R$ ${(totalRecebido - totalEmprestado).toFixed(2)}`;
  resumoAtrasados.innerText = atrasados;
}

/* ===============================
   PARCELAS
================================ */
async function abrirParcelas(id) {
  emprestimoAtual = id;
  const emp = (await getEmprestimos()).find(e => e.id === id);

  const modal = document.getElementById("modalParcelas");
  const lista = document.getElementById("listaParcelas");
  if (!modal || !lista) return;

  lista.innerHTML = "";

  emp.parcelas.forEach((p, i) => {
    lista.innerHTML += `
      <div class="linha-parcela ${p.pago ? "pago" : ""}">
        Parcela ${p.numero} — R$ ${p.valor.toFixed(2)} — ${formatarData(p.vencimento)}
        ${
          p.pago
            ? "✔️"
            : `<button onclick="pagarParcela(${i})">Receber</button>`
        }
      </div>
    `;
  });

  modal.style.display = "block";
}

async function pagarParcela(index) {
  const emprestimos = await getEmprestimos();
  const emp = emprestimos.find(e => e.id === emprestimoAtual);

  const parcela = emp.parcelas[index];
  if (parcela.pago) return;

  parcela.pago = true;

  await addPagamento({
    emprestimoId: emp.id,
    valor: parcela.valor,
    data: new Date().toISOString().split("T")[0]
  });

  const tx = db.transaction("emprestimos", "readwrite");
  tx.objectStore("emprestimos").put(emp);

  fecharModal();
  setTimeout(carregarTabela, 100);
}

/* ===============================
   FILTRO RECEBIMENTOS
================================ */
async function filtrarRecebimentos() {
  const ini = filtroInicio.value;
  const fim = filtroFim.value;

  if (!ini || !fim) {
    alert("Informe o período");
    return;
  }

  modoRecebimentos = true;
  const tbody = document.getElementById("tabelaEmprestimos");
  tbody.innerHTML = "";

  let total = 0;
  const emprestimos = await getEmprestimos();

  for (const e of emprestimos) {
    if (!e.parcelas) continue;
    const cliente = await getCliente(e.clienteId);

    for (const p of e.parcelas) {
      if (!p.pago && p.vencimento >= ini && p.vencimento <= fim) {
        total += p.valor;

        tbody.innerHTML += `
          <tr>
            <td>${cliente.nome}</td>
            <td colspan="2">Parcela ${p.numero}</td>
            <td>R$ ${p.valor.toFixed(2)}</td>
            <td colspan="2">${formatarData(p.vencimento)}</td>
            <td class="em-dia">A receber</td>
            <td>-</td>
          </tr>
        `;
      }
    }
  }

  resumoReceber.innerText = `R$ ${total.toFixed(2)}`;
}

/* ===============================
   MODAIS
================================ */
function abrirModalEmprestimo() {
  const modal = document.getElementById("modalEmprestimo");
  if (modal) modal.style.display = "block";
}

function abrirModalPagamento(id) {
  emprestimoAtual = id;

  const modal =
    document.getElementById("modalPagamento") ||
    document.querySelector(".modal-pagamento") ||
    document.querySelector("[data-modal='pagamento']");

  if (!modal) {
    alert("Modal de pagamento não encontrado no HTML");
    console.error("Modal de pagamento não encontrado");
    return;
  }

  modal.style.display = "block";
}

function fecharModal() {
  ["modalEmprestimo", "modalPagamento", "modalParcelas"].forEach(id => {
    const m = document.getElementById(id);
    if (m) m.style.display = "none";
  });
  emprestimoAtual = null;
}

// fechar clicando fora
window.onclick = function (e) {
  if (e.target.classList.contains("modal")) fecharModal();
};

/* ===============================
   JUROS
================================ */
function atualizarModoCobranca() {
  juros.disabled = tipoCobranca.value === "fixo";
}

function calcularTotal() {
  const v = Number(valor.value);
  const j = Number(juros.value) || 0;
  totalReceber.value = (v + v * j / 100).toFixed(2);
}

/* ===============================
   SALVAR
================================ */
async function salvarEmprestimo() {
  const nome = nomeCliente.value.trim();
  const telefone = telefoneCliente.value.trim();
  const valorEmp = Number(valor.value);
  const total = Number(totalReceber.value);

  if (!nome || !valorEmp || !total) {
    alert("Preencha todos os campos");
    return;
  }

  const clienteId = await addCliente({ nome, telefone });

  const parcelas = gerarParcelas(
    total,
    Number(qtdParcelas.value),
    primeiroVencimento.value
  );

  await addEmprestimo({
    clienteId,
    valor: valorEmp,
    totalReceber: total,
    parcelas,
    vencimento: parcelas.at(-1).vencimento
  });

  fecharModal();
  setTimeout(carregarTabela, 100);
}

/* ===============================
   PAGAMENTO MANUAL
================================ */
async function confirmarPagamento() {
  await addPagamento({
    emprestimoId: emprestimoAtual,
    valor: Number(valorPagamento.value),
    data: new Date().toISOString().split("T")[0]
  });

  fecharModal();
  setTimeout(carregarTabela, 100);
}

/* ===============================
   EXCLUIR
================================ */
async function confirmarExclusao(id) {
  if (!confirm("Excluir cliente e dados?")) return;
  await excluirCliente(id);
  setTimeout(carregarTabela, 100);
}

/* ===============================
   UTIL
================================ */
function formatarData(data) {
  return new Date(data).toLocaleDateString("pt-BR");
}
