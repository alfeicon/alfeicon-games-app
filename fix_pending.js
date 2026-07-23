const fs = require("fs");
let code = fs.readFileSync("app/admin/_components/Entregas.tsx", "utf8");

const pendingBlock = `
                  {selectedOrder?.payment_status === "pending" && selectedOrder?.receipt_url && (
                    <div className="flex flex-col items-center justify-center gap-4 py-8">
                      <p className="text-sm font-black uppercase tracking-widest text-yellow-500">Comprobante de Pago</p>
                      
                      <button type="button" onClick={() => setFullscreenImage(selectedOrder.receipt_url)} className="relative group block w-full max-w-sm overflow-hidden rounded-2xl border border-white/10">
                        <img src={selectedOrder.receipt_url} alt="Comprobante" className="max-h-96 w-full bg-black/40 object-contain transition-transform group-hover:scale-[1.02]" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="rounded-full bg-black/80 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur-md">
                            Ampliar Imagen
                          </span>
                        </div>
                      </button>

                      <div className="mt-4 flex w-full max-w-sm gap-3">
                        <button type="button" onClick={async () => {
                          if(!supabase) return;
                          if(!confirm("¿Rechazar este comprobante y borrar la orden?")) return;
                          await supabase.from("orders").delete().eq("id", selectedOrder.id);
                          onReload();
                          close();
                        }} className="flex-1 rounded-full border border-red-500/20 bg-red-500/10 py-3 text-xs font-black uppercase tracking-widest text-red-500 transition-colors hover:bg-red-500/20 active:scale-95">
                          Rechazar
                        </button>
                        <button type="button" onClick={async () => {
                          if(!supabase) return;
                          await supabase.from("orders").update({ payment_status: "paid" }).eq("id", selectedOrder.id);
                          setSelectedOrder({ ...selectedOrder, payment_status: "paid" });
                          showNotice("success", "Pago aprobado");
                          onReload();
                        }} className="flex-[1.4] rounded-full bg-green-500 py-3 text-xs font-black uppercase tracking-widest text-black transition-colors hover:bg-green-400 active:scale-95">
                          Aprobar Pago
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {(!selectedOrder || selectedOrder.payment_status !== "pending") && (
`;

code = code.replace(
  `<div className="flex-1 space-y-5 overflow-y-auto p-5 pb-8">\n\n\n                  <div className="flex flex-col md:flex-row gap-5">`,
  `<div className="flex-1 space-y-5 overflow-y-auto p-5 pb-8">\n` + pendingBlock + `\n                  <div className="flex flex-col md:flex-row gap-5">`
);

// We need to close the conditional block at the end of the form
code = code.replace(
  `                  </div>\n                  </div>\n  \n                  <div className="shrink-0 space-y-2.5`,
  `                  </div>\n                  </div>\n                  )}\n  \n                  {(!selectedOrder || selectedOrder.payment_status !== "pending") && (\n                  <div className="shrink-0 space-y-2.5`
);

// And we need to close THAT conditional block!
code = code.replace(
  `                      </button>\n                    )}\n                  </div>`,
  `                      </button>\n                    )}\n                  </div>\n                  )}`
);

fs.writeFileSync("app/admin/_components/Entregas.tsx", code);
console.log("Applied pending layout.");
