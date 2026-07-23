const fs = require("fs");
let code = fs.readFileSync("app/admin/_components/Entregas.tsx", "utf8");

// We only need to replace the layout structure inside the <form>.
// The easiest way is to wrap everything in a `<div className="flex gap-4">...</div>`.

const lines = code.split("\n");
const sIdx = lines.findIndex(l => l.includes("{!selectedOrder && ("));
const eIdx = lines.findIndex(l => l.includes("<div className=\"shrink-0 space-y-2.5 border-t border-white/[0.06] bg-[rgb(9,9,11)] p-4\">"));

if (sIdx !== -1 && eIdx !== -1) {
  let block = lines.slice(sIdx, eIdx).join("\n");
  
  // We want to create two columns:
  // Col 1: Cómo funciona, Código proporcionado, Link para cliente (if these exist)
  // Col 2: Juego / Pack, Stepper, Estado, Datos para Venta, Datos Cliente
  
  // Actually a simpler way is to wrap the blocks with simple divs.
  // We can use a regex to replace the sections.
  
  const formLayout = `
                  <div className="flex flex-col md:flex-row gap-5">
                    <div className="flex-[1.2] space-y-5">
                      {/* Left Column content */}
                      <div className="relative">
                        <label>
                          <span className={"mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500"}>Juego / Pack comprado</span>
                          <input value={form.game_name} onChange={e => setForm({ ...form, game_name: e.target.value })}
                            onFocus={() => setShowSuggestions(true)}
                            className={"w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white outline-none transition-colors focus:border-yellow-500/50"} placeholder="Ej: Mario Kart 8 Deluxe" required />
                        </label>
                        
                        {showSuggestions && (
                          <div className="mt-2 rounded-xl border border-white/10 bg-[#0c0f12] p-2 shadow-inner">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 px-1">Catálogo</p>
                            <div className="flex flex-col gap-1 max-h-60 overflow-y-auto pr-1">
                              {suggestions.map(item => (
                                <button key={\`\${item.type}-\${item.id}\`} type="button" onClick={() => addSuggestion(item)}
                                  className="flex items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-white/10 transition-colors">
                                  {item.type === "pack" ? <Gift size={13} className="text-purple-400 shrink-0" /> : <Gamepad2 size={13} className="text-blue-400 shrink-0" />}
                                  <span className="text-[12px] font-bold text-gray-300 leading-tight">{item.title}</span>
                                </button>
                              ))}
                              {suggestions.length === 0 && (
                                <p className="py-3 text-center text-[11px] text-gray-600">Sin resultados</p>
                              )}
                            </div>
                            <div className="mt-2 text-center pt-2 border-t border-white/5">
                              <button type="button" onClick={() => setShowSuggestions(false)}
                                className="text-[10px] w-full py-2 font-bold text-gray-400 hover:text-white uppercase tracking-widest transition-colors rounded hover:bg-white/5">Cerrar catálogo</button>
                            </div>
                          </div>
                        )}
                      </div>

                      {selectedOrder && (
                        <>
                          {/* Stepper visual del progreso */}
                          <div>
                            <span className={"mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500"}>Progreso de la entrega</span>
                            <div className="flex items-start rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-3.5">
                              {STEPS.map((step, i) => {
                                const done = currentStepIndex > i;
                                const current = currentStepIndex === i;
                                return (
                                  <div key={step.key} className="flex flex-1 items-center">
                                    <div className="flex flex-col items-center gap-1.5">
                                      <div className={\`flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-black transition-all duration-300 \${
                                        current ? "border-yellow-500 bg-yellow-500 text-black shadow-[0_0_12px_rgba(234,179,8,0.4)]"
                                        : done ? "border-green-500/40 bg-green-500/20 text-green-400"
                                        : "border-white/10 bg-white/5 text-gray-600"
                                      }\`}>
                                        {done ? <Check size={13} strokeWidth={3} /> : i + 1}
                                      </div>
                                      <span className={\`text-[8px] font-black uppercase tracking-wider \${
                                        current ? "text-white" : done ? "text-green-400/70" : "text-gray-600"
                                      }\`}>{step.label}</span>
                                    </div>
                                    {i < STEPS.length - 1 && (
                                      <div className={\`mx-1 mt-3.5 h-0.5 flex-1 self-start rounded-full transition-colors duration-300 \${done ? "bg-green-500/40" : "bg-white/10"}\`} />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <label className="block">
                            <span className={"mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500"}>Cambiar estado manualmente</span>
                            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Order["status"] })}
                              className={"w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white outline-none transition-colors focus:border-yellow-500/50 appearance-none cursor-pointer"}>
                              <option value="draft">0 · Borrador (Nueva Consulta)</option>
                              <option value="pending_console_code">1 · Esperando código del cliente</option>
                              <option value="pending_setup">2 · Código recibido</option>
                              <option value="preparing">3 · Avisado (prepárate, 85%)</option>
                              <option value="ready">4 · Credenciales entregadas</option>
                              <option value="completed">5 · Entrega completa</option>
                              <option value="issue">⚠ Problema en instalación (soporte)</option>
                            </select>
                          </label>

                          <div className="rounded-xl border border-green-500/15 bg-green-500/[0.03] p-4 mt-2">
                            <div className="mb-3 flex items-center gap-2">
                              <CheckCircle2 size={13} className="text-green-500" />
                              <p className="text-[10px] font-black uppercase tracking-widest text-white">Datos para la Venta (Auto)</p>
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                              <label>
                                <span className={"mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500"}>Precio Venta ($)</span>
                                <input type="number" min="0" value={form.sale_price} onChange={e => setForm({ ...form, sale_price: e.target.value ? Number(e.target.value) : "" })} className={"w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white outline-none transition-colors focus:border-yellow-500/50"} placeholder="Ej: 15000" />
                              </label>
                              <label>
                                <span className={"mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500"}>Precio Costo ($)</span>
                                <input type="number" min="0" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value ? Number(e.target.value) : "" })} className={"w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white outline-none transition-colors focus:border-yellow-500/50"} placeholder="Ej: 5000" />
                              </label>
                              <label>
                                <span className={"mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500"}>Proveedor</span>
                                <select value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })} className={"w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white outline-none transition-colors focus:border-yellow-500/50 appearance-none cursor-pointer"}>
                                  <option value="">- Seleccionar -</option>
                                  {providers.filter(p => p.is_active).map(p => (
                                    <option key={p.id} value={p.name}>{p.name}</option>
                                  ))}
                                </select>
                              </label>
                            </div>

                            <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
                              <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-300">
                                  <input type="checkbox" checked={splitEnabled} onChange={e => setSplitEnabled(e.target.checked)}
                                    className="h-3.5 w-3.5 rounded accent-pink-500" />
                                  <Handshake size={13} className="text-pink-400" /> Dividir ganancia con {partnerName}
                                </label>
                                {splitEnabled && (
                                  <div className="flex items-center gap-1">
                                    <input value={form.partner_pct} onChange={e => setForm({ ...form, partner_pct: e.target.value === "" ? "" : Number(e.target.value.replace(/[^0-9]/g, "")) })}
                                      inputMode="numeric"
                                      className="w-14 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-right text-sm font-black text-white outline-none focus:border-pink-500" />
                                    <span className="text-xs font-black text-gray-500">%</span>
                                  </div>
                                )}
                              </div>
                              {splitEnabled && Number(form.sale_price) > 0 && (
                                <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2 text-xs">
                                  <span className="text-gray-500">
                                    {partnerName} ({Number(form.partner_pct) || 0}%): <span className="font-black text-pink-400">
                                      \${Math.round((Number(form.sale_price) - Number(form.cost_price || 0)) * (Number(form.partner_pct) || 0) / 100).toLocaleString("es-CL")}
                                    </span>
                                  </span>
                                  <span className="text-gray-500">
                                    Tú ({100 - (Number(form.partner_pct) || 0)}%): <span className="font-black text-green-400">
                                      \${Math.round((Number(form.sale_price) - Number(form.cost_price || 0)) * (100 - (Number(form.partner_pct) || 0)) / 100).toLocaleString("es-CL")}
                                    </span>
                                  </span>
                                </div>
                              )}
                            </div>

                            <p className="mt-2.5 text-[10px] text-gray-600">Al pasar a estado "Completada", estos datos se registrarán automáticamente en tus Ventas. Si lo vendido es un pack, se eliminará del catálogo.</p>
                          </div>

                          <div className="rounded-xl border border-yellow-500/15 bg-yellow-500/[0.03] p-4 mt-2">
                            <div className="mb-3 flex items-center gap-2">
                              <KeyRound size={13} className="text-yellow-500" />
                              <p className="text-[10px] font-black uppercase tracking-widest text-white">Datos que recibirá el cliente</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <label>
                                <span className={"mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500"}>Código (5 dígitos)</span>
                                <input inputMode="numeric" value={form.account_email}
                                  onChange={e => setForm({ ...form, account_email: e.target.value.replace(/\\D/g, "").slice(0, 5) })}
                                  className={"w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white outline-none transition-colors focus:border-yellow-500/50 text-center font-mono text-lg font-black tracking-[0.4em]"} placeholder="12345" maxLength={5} />
                              </label>

                              <label>
                                <span className={"mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500"}>Contraseña</span>
                                <input type="text" value={form.account_password} onChange={e => setForm({ ...form, account_password: e.target.value })}
                                  className={"w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white outline-none transition-colors focus:border-yellow-500/50"} placeholder="Contraseña123" />
                              </label>
                            </div>
                            <p className="mt-2.5 text-[10px] text-gray-600">El cliente verá estos datos al marcar la orden como "Listo".</p>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex-[0.8] space-y-5">
                      {/* Right Column content */}
                      {!selectedOrder && (
                        <div className="rounded-2xl border border-yellow-500/15 bg-yellow-500/[0.04] p-4">
                          <div className="mb-3 flex items-center gap-2">
                            <PackageCheck size={14} className="text-yellow-500" />
                            <p className="text-[11px] font-black uppercase tracking-widest text-white">Cómo funciona</p>
                          </div>
                          <ol className="space-y-2 text-[11.5px] leading-tight text-gray-400">
                            <li className="flex gap-2.5"><span className="font-black text-yellow-500">1.</span> Escribe el juego o pack que compró el cliente.</li>
                            <li className="flex gap-2.5"><span className="font-black text-yellow-500">2.</span> Se genera un <b className="text-gray-200">código único (ALF-XXXX)</b> y un link.</li>
                            <li className="flex gap-2.5"><span className="font-black text-yellow-500">3.</span> Le envías el link al cliente por WhatsApp.</li>
                          </ol>
                        </div>
                      )}

                      {selectedOrder && form.status !== 'draft' && (
                        <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-4">
                          <div className="mb-2.5 flex items-center gap-2">
                            <Hash size={13} className="text-gray-500" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Código proporcionado por el cliente</p>
                          </div>
                          {selectedOrder.console_code ? (
                            <div className="flex flex-col items-center gap-2.5">
                              <div className="flex w-full items-center gap-2">
                                <p className="flex-1 rounded-xl border border-white/10 bg-black/30 p-3.5 text-center font-mono text-2xl font-black tracking-[0.25em] text-white">{selectedOrder.console_code}</p>
                                <button type="button" title="Copiar código"
                                  onClick={() => { navigator.clipboard.writeText(selectedOrder.console_code || ""); showNotice("success", "Código del cliente copiado"); }}
                                  className="flex shrink-0 items-center justify-center self-stretch rounded-xl border border-white/10 bg-white/5 px-3.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white active:scale-95">
                                  <Copy size={16} />
                                </button>
                              </div>
                              {form.status === "pending_setup" ? (
                                <button type="button" onClick={async () => {
                                  if (!supabase) return;
                                  const { error } = await supabase.from("orders").update({ status: "preparing" }).eq("id", selectedOrder.id);
                                  if (error) { showNotice("error", \`No se pudo avisar: \${error.message}\`); return; }
                                  setForm({ ...form, status: "preparing" });
                                  showNotice("success", "Cliente avisado — barra al 85%.");
                                  await onReload();
                                }} className="w-full bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors border border-green-500/30 rounded-lg py-2 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                                  <PackageCheck size={14} /> Avisar que te estás preparando (Salta a 85%)
                                </button>
                              ) : (
                                <div className="w-full rounded-lg border border-white/8 bg-white/[0.03] py-2 text-center text-[11px] font-bold uppercase tracking-widest text-gray-500 flex items-center justify-center gap-2">
                                  <CheckCircle2 size={13} className="text-green-500/70" /> Cliente ya avisado
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-600 italic">El cliente aún no ha ingresado el código.</p>
                          )}
                          <p className="text-[10px] text-gray-600 mt-2">
                            Usa este código en la web de Nintendo para vincular la cuenta. Luego ingresa las credenciales abajo y cambia el estado a "Listo".
                          </p>
                        </div>
                      )}

                      {selectedOrder && (
                        <div className="rounded-xl border border-blue-500/15 bg-blue-500/[0.03] p-4 mt-2">
                          <div className="mb-2 flex items-center gap-2">
                            <Copy size={13} className="text-blue-500" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-white">Link para el cliente</p>
                          </div>
                          <div className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-black/50 p-2">
                            <input readOnly value={\`\${window.location.origin}/entrega/\${selectedOrder.short_code}\`} className="flex-1 bg-transparent px-2 text-[11px] text-gray-400 outline-none" />
                            <button onClick={() => {
                              navigator.clipboard.writeText(\`\${window.location.origin}/entrega/\${selectedOrder.short_code}\`);
                              showNotice("success", "Enlace copiado");
                            }} type="button" className="flex items-center gap-2 rounded-lg bg-blue-500/20 px-3 py-2 text-blue-400 hover:bg-blue-500/30 transition-colors">
                              <span className="text-[10px] font-bold uppercase tracking-wider">Copiar</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
  `;
  
  lines.splice(sIdx, eIdx - sIdx, formLayout);
  fs.writeFileSync("app/admin/_components/Entregas.tsx", lines.join("\n"));
  console.log("Success");
}
