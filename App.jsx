import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

function App() {
  const [convidados, setConvidados] = useState(() => {
    const dadosSalvos = localStorage.getItem("convidados");
    return dadosSalvos ? JSON.parse(dadosSalvos) : [];
  });

  const [naoConvidados, setNaoConvidados] = useState(() => {
    const dadosSalvos = localStorage.getItem("naoConvidados");
    return dadosSalvos ? JSON.parse(dadosSalvos) : [];
  });

  const [nomeNovo, setNomeNovo] = useState("");
  const [telefoneNovo, setTelefoneNovo] = useState("");
  const [editandoIndex, setEditandoIndex] = useState(null);

  const [evento, setEvento] = useState(() => {
    return localStorage.getItem("evento") || "";
  });

  useEffect(() => {
    localStorage.setItem("convidados", JSON.stringify(convidados));
  }, [convidados]);

  useEffect(() => {
    localStorage.setItem("naoConvidados", JSON.stringify(naoConvidados));
  }, [naoConvidados]);

  useEffect(() => {
    localStorage.setItem("evento", evento);
  }, [evento]);

  const marcarPresenca = (index) => {
    const novaLista = [...convidados];
    novaLista[index].presente = true;
    setConvidados(novaLista);
  };

  const adicionarOuEditarNaoConvidado = () => {
    if (nomeNovo.trim() === "" || telefoneNovo.trim() === "") return;
    const novo = { nome: nomeNovo.trim(), telefone: telefoneNovo.trim() };
    if (editandoIndex !== null) {
      const lista = [...naoConvidados];
      lista[editandoIndex] = novo;
      setNaoConvidados(lista);
      setEditandoIndex(null);
    } else {
      setNaoConvidados([...naoConvidados, novo]);
    }
    setNomeNovo("");
    setTelefoneNovo("");
  };

  const editarNaoConvidado = (index) => {
    const selecionado = naoConvidados[index];
    setNomeNovo(selecionado.nome);
    setTelefoneNovo(selecionado.telefone);
    setEditandoIndex(index);
  };

  const removerNaoConvidado = (index) => {
    const novaLista = naoConvidados.filter((_, i) => i !== index);
    setNaoConvidados(novaLista);
    if (editandoIndex === index) {
      setEditandoIndex(null);
      setNomeNovo("");
      setTelefoneNovo("");
    }
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      const dadosImportados = json
        .filter((row) => {
          const keys = Object.keys(row);
          const nomeKey = keys.find(k => k.toLowerCase() === "nome");
          const telKey = keys.find(k => k.toLowerCase() === "telefone");
          return nomeKey && telKey && row[nomeKey] && row[telKey];
        })
        .map((row) => {
          const keys = Object.keys(row);
          const nomeKey = keys.find(k => k.toLowerCase() === "nome");
          const telKey = keys.find(k => k.toLowerCase() === "telefone");
          const convidadoPorKey = keys.find(k => k.toLowerCase() === "convidadopor");
          return {
            nome: row[nomeKey].toString().trim(),
            telefone: row[telKey].toString().trim(),
            convidadoPor: convidadoPorKey ? row[convidadoPorKey].toString().trim() : "",
            presente: false,
          };
        });

      setConvidados(dadosImportados);
    };
    reader.readAsArrayBuffer(file);
  };

  const salvarNoGoogleSheets = () => {
    if (!evento.trim()) return alert("Insira o nome do evento");

    const url = "https://v1.nocodeapi.com/diauto/google_sheets/SBCZkxAzjydRFoDp?tabId=Dados";

    const headers = ["Evento", "Nome", "Telefone", "Presente", "Convidado por"];
    const linhas = convidados.map(c => [
      evento.trim(),
      c.nome,
      c.telefone,
      c.presente ? "Sim" : "Não",
      c.convidadoPor || ""
    ]);

    const linhasNaoConvidados = naoConvidados.map(n => [
      evento.trim(),
      n.nome,
      n.telefone,
      "Sim",
      "Visitante"
    ]);

    const corpo = [headers, ...linhas, ...linhasNaoConvidados];

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: corpo })
    })
      .then(res => res.json())
      .then(res => {
        if (res.error) {
          alert("Erro ao salvar: " + res.info);
        } else {
          alert("Salvo com sucesso no Google Sheets!");
        }
      })
      .catch(err => alert("Erro de rede: " + err.message));
  };

  const gerarRelatorio = () => {
    const presentes = convidados.filter(c => c.presente);
    const faltaram = convidados.filter(c => !c.presente);

    const sheetPresentes = XLSX.utils.json_to_sheet(presentes);
    const sheetFaltaram = XLSX.utils.json_to_sheet(faltaram);
    const sheetNaoListados = XLSX.utils.json_to_sheet(naoConvidados);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheetPresentes, "Presentes");
    XLSX.utils.book_append_sheet(wb, sheetFaltaram, "Faltaram");
    XLSX.utils.book_append_sheet(wb, sheetNaoListados, "NaoListados");

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    saveAs(blob, "relatorio_final.xlsx");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-2xl mx-auto bg-white shadow-xl rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-center mb-4 text-red-600">Check-in do Evento</h1>

        <div className="mb-4">
          <label className="block mb-1 font-semibold text-gray-700">Nome do Evento:</label>
          <input type="text" value={evento} onChange={(e) => setEvento(e.target.value)} placeholder="Ex: Lançamento Tera" className="border rounded p-2 w-full mb-4" />
        </div>

        <div className="mb-4">
          <label className="block mb-1 font-semibold text-gray-700">Importar Planilha Excel (.xlsx):</label>
          <input type="file" accept=".xlsx" onChange={handleImport} className="border rounded p-2 w-full" />
        </div>

        <p className="text-gray-700 mb-2">Confirmados: {convidados.length}</p>
        <p className="text-green-600 mb-4">Presentes: {convidados.filter(c => c.presente).length}</p>

        <div className="flex gap-2 mb-6">
          <button onClick={gerarRelatorio} className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">Gerar Relatório Final</button>
          <button onClick={salvarNoGoogleSheets} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Salvar no Google Sheets</button>
        </div>

        <ul className="space-y-2 mb-6">
          {convidados.map((convidado, index) => (
            <li key={index} className="flex justify-between items-center bg-gray-50 p-2 rounded shadow">
              <div>
                <p className="font-semibold">{convidado.nome}</p>
                <p className="text-sm text-gray-500">{convidado.telefone}</p>
                {convidado.convidadoPor && (
                  <p className="text-sm text-gray-400 italic">Convidado por: {convidado.convidadoPor}</p>
                )}
              </div>
              {!convidado.presente && (
                <button onClick={() => marcarPresenca(index)} className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600">✔ Presente</button>
              )}
            </li>
          ))}
        </ul>

        <div className="border-t pt-4">
          <h2 className="text-lg font-semibold mb-2">Visitantes não listados</h2>
          <div className="flex flex-col gap-2 mb-2">
            <input type="text" value={nomeNovo} onChange={(e) => setNomeNovo(e.target.value)} placeholder="Nome completo" className="border rounded px-2 py-1" />
            <input type="text" value={telefoneNovo} onChange={(e) => setTelefoneNovo(e.target.value)} placeholder="Telefone" className="border rounded px-2 py-1" />
            <button onClick={adicionarOuEditarNaoConvidado} className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600">
              {editandoIndex !== null ? "Salvar" : "Adicionar"}
            </button>
          </div>
          {naoConvidados.length > 0 && (
            <ul className="list-disc list-inside text-sm text-gray-700">
              {naoConvidados.map((n, i) => (
                <li key={i} className="flex justify-between items-center">
                  <span>{n.nome} - {n.telefone}</span>
                  <div className="space-x-2">
                    <button onClick={() => editarNaoConvidado(i)} className="text-sm text-yellow-600 hover:underline">Editar</button>
                    <button onClick={() => removerNaoConvidado(i)} className="text-sm text-red-600 hover:underline">Remover</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
