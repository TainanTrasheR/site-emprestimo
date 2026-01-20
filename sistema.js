let emprestimoAtual = null;
let filtroAtual = "todos";

document.addEventListener("dbPronto", carregarTabela);

/* ===============================
   FILTRO
================================ */
function setFiltro(filtro) {
  filtroAtual = filtro;
  carregarTabela();
}

/* ===============================
   CARREGAR TABELA + RESUMO
================================ */
async function carregarTabela() {
  const tbody = document.getElementById("tabelaEmprestimos");
  tbody.innerHTML = "";

  let totalEmprestado = 0;
  let totalReceber = 0;
  let totalRecebido = 0;
  let atrasados = 0;

  const emprestimos = await getEmprestimos();
  const hoje = new Date();

  for (const e of emprestimos) {
    const cliente = await getCliente(e.clienteId);
    if (!cliente) continue;

    const pagamentos = await getPagamentosPorEmprestimo(e.id);
    const recebido = pagamentos.reduce((s, p) => s + Number(p.valor), 0);

    const total = Number(e.totalReceber);
    const lucro = recebido - e.valor;

    totalEmprestado += e.valor;
    totalReceber += total;
    totalRecebido += recebido;

    let status = "Em dia";
    let classe = "em-dia";
    let atrasado = false;

    if (recebido >= total) {
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

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${cliente.nome}</td>
      <td>${cliente.telefone || ""}</td>
      <td>R$ ${e.valor.toFixed(2)}</td>
      <td>R$ ${total.toFixed(2)}</td>
      <td>R$ ${recebido.toFixed(2)}</td>
      <td>R$ ${lucro.toFixed(2)}</td>
      <td>${formatarData(e.vencimento)}</td>
      <td class="${classe}">${status}</td>
      <td>
        <button onclick="abrirModalPagamento(${e.id})">💰</button>
        <button onclick="confirmarExclusao(${cliente.id})">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  document.getElementById("resumoEmprestado").innerText = `R$ ${totalEmprestado.toFixed(2)}`;
  document.getElementById("resumoReceber").innerText = `R$ ${totalReceber.toFixed(2)}`;
  document.getElementById("resumoRecebido").innerText = `R$ ${totalRecebido.toFixed(2)}`;
  document.getElementById("resumoLucro").innerText = `R$ ${(totalRecebido - totalEmprestado).toFixed(2)}`;
  document.getElementById("resumoAtrasados").innerText = atrasados;
}

/* ===============================
   MODAIS
================================ */
function abrirModalEmprestimo() {
  document.getElementById("modalEmprestimo").style.display = "block";
}

function fecharModal() {
  document.getElementById("modalEmprestimo").style.display = "none";
  document.getElementById("modalPagamento").style.display = "none";
}

/* ===============================
   JUROS / FIXO
================================ */
function atualizarModoCobranca() {
  const tipo = document.getElementById("tipoCobranca").value;
  document.getElementById("juros").disabled = tipo === "fixo";
  document.getElementById("totalReceber").disabled = tipo === "juros";
  calcularTotal();
}

function calcularTotal() {
  const valor = Number(document.getElementById("valor").value);
  const juros = Number(document.getElementById("juros").value) || 0;

  if (!valor) return;

  document.getElementById("totalReceber").value =
    (valor + valor * juros / 100).toFixed(2);
}

/* ===============================
   SALVAR EMPRÉSTIMO (FIX DEFINITIVO)
================================ */
async function salvarEmprestimo() {
  const nome = document.getElementById("nomeCliente").value.trim();
  const telefone = document.getElementById("telefoneCliente").value.trim();
  const valor = Number(document.getElementById("valor").value);
  const totalReceber = Number(document.getElementById("totalReceber").value);
  const vencimento = document.getElementById("vencimento").value;

  if (!nome || !valor || !totalReceber || !vencimento) {
    alert("Preencha todos os campos");
    return;
  }

  const clienteId = await addCliente({ nome, telefone });

  await addEmprestimo({
    clienteId,
    valor,
    totalReceber,
    vencimento
  });

  fecharModal();
  carregarTabela();
}

/* ===============================
   PAGAMENTO
================================ */
function abrirModalPagamento(id) {
  emprestimoAtual = id;
  document.getElementById("modalPagamento").style.display = "block";
}

async function confirmarPagamento() {
  const valorPago = Number(document.getElementById("valorPagamento").value);
  if (!valorPago) return;

  await addPagamento({
    emprestimoId: emprestimoAtual,
    valor: valorPago,
    data: new Date().toISOString().split("T")[0]
  });

  fecharModal();
  carregarTabela();
}

/* ===============================
   EXCLUIR
================================ */
async function confirmarExclusao(id) {
  if (!confirm("Excluir cliente e todos os dados?")) return;
  await excluirCliente(id);
  carregarTabela();
}

/* ===============================
   UTIL
================================ */
function formatarData(data) {
  return new Date(data).toLocaleDateString("pt-BR");
}
