import React, { useState, useRef } from 'react';
import { UserProfile } from '../types';
import { Award, BookOpen, AlertTriangle, ShieldCheck, Flame, Star, Sparkles, Plus, CheckCircle2, Download, Upload, FileJson, Check } from 'lucide-react';

interface ChefNotebookProps {
  userProfile: UserProfile;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
}

export const ChefNotebook: React.FC<ChefNotebookProps> = ({ userProfile, onUpdateProfile }) => {
  const [newMistakeInput, setNewMistakeInput] = useState('');
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const nextLevelXp = userProfile.level * 100;
  const currentLevelBaseXp = (userProfile.level - 1) * 100;
  const progressInLevel = Math.min(
    100,
    Math.max(0, ((userProfile.xp - currentLevelBaseXp) / (nextLevelXp - currentLevelBaseXp)) * 100)
  );

  const handleAddMistake = () => {
    if (!newMistakeInput.trim()) return;
    if (!userProfile.pastMistakes.includes(newMistakeInput.trim())) {
      onUpdateProfile({
        pastMistakes: [...userProfile.pastMistakes, newMistakeInput.trim()],
      });
    }
    setNewMistakeInput('');
  };

  const handleRemoveMistake = (mistakeToRemove: string) => {
    onUpdateProfile({
      pastMistakes: userProfile.pastMistakes.filter((m) => m !== mistakeToRemove),
    });
  };

  // Exportar copia de seguridad local en JSON
  const handleExportBackup = () => {
    try {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(userProfile, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `chef-cero-cuaderno-${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setBackupNotice('¡Copia de seguridad descargada exitosamente!');
      setTimeout(() => setBackupNotice(null), 4000);
    } catch (e) {
      console.warn('Error exportando cuaderno:', e);
    }
  };

  // Importar y restaurar copia de seguridad
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object') {
          onUpdateProfile({
            ...parsed,
            pastMistakes: Array.isArray(parsed.pastMistakes) ? parsed.pastMistakes : userProfile.pastMistakes,
            cookedHistory: Array.isArray(parsed.cookedHistory) ? parsed.cookedHistory : userProfile.cookedHistory,
            unlockedBadges: Array.isArray(parsed.unlockedBadges) ? parsed.unlockedBadges : userProfile.unlockedBadges,
            xp: typeof parsed.xp === 'number' ? parsed.xp : userProfile.xp,
            level: typeof parsed.level === 'number' ? parsed.level : userProfile.level,
            levelTitle: typeof parsed.levelTitle === 'string' ? parsed.levelTitle : userProfile.levelTitle,
          });
          setBackupNotice('¡Cuaderno de cocina restaurado con éxito!');
          setTimeout(() => setBackupNotice(null), 4000);
        }
      } catch (err) {
        console.warn('Error al leer archivo de respaldo:', err);
        setBackupNotice('El archivo seleccionado no es un archivo JSON válido de Chef Cero.');
        setTimeout(() => setBackupNotice(null), 4000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Profile Header & Skill Level Progression */}
      <div className="bg-gradient-to-r from-stone-900 to-stone-800 text-white p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-10 translate-y-10">
          <BookOpen className="w-80 h-80 text-white" />
        </div>

        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold border border-amber-400/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Memoria Evolutiva de Cocina</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold font-serif">
                Mi Cuaderno de Chef
              </h2>
              <p className="text-xs sm:text-sm text-stone-300 mt-1 max-w-xl">
                Aquí vive tu historial culinario. Gemini lee este cuaderno antes de cada plato para advertirte sobre tus errores habituales (como el ajo o el fuego alto) y recomendarte técnicas a tu medida.
              </p>
            </div>

            {/* Acciones de Copia de Seguridad */}
            <div className="flex items-center gap-2 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImportFile}
                className="hidden"
                aria-label="Cargar archivo de respaldo JSON"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Cargar y restaurar cuaderno guardado"
                className="px-3 py-1.5 bg-stone-800/90 hover:bg-stone-700 text-stone-200 border border-stone-600 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                <span>Restaurar</span>
              </button>
              <button
                onClick={handleExportBackup}
                title="Descargar copia de seguridad en JSON"
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5 text-stone-950" />
                <span>Exportar Copia</span>
              </button>
            </div>
          </div>

          {/* Banner de confirmación de copia de seguridad */}
          {backupNotice && (
            <div
              role="status"
              className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 px-4 py-2 rounded-xl text-xs flex items-center gap-2 animate-fade-in"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{backupNotice}</span>
            </div>
          )}

          {/* Level & XP Progress Bar */}
          <div className="bg-stone-800/80 backdrop-blur-sm p-4 rounded-2xl border border-stone-700 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-amber-400 font-bold uppercase tracking-wider block">
                  Tu Rango Actual:
                </span>
                <span className="text-lg font-bold text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  {userProfile.levelTitle}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-stone-400 block">Experiencia Acumulada</span>
                <span className="text-sm font-bold font-mono text-amber-300">
                  {userProfile.xp} XP
                </span>
              </div>
            </div>

            {/* Bar */}
            <div className="space-y-1">
              <div className="w-full bg-stone-900 h-2.5 rounded-full overflow-hidden border border-stone-700">
                <div
                  className="bg-gradient-to-r from-amber-500 to-amber-300 h-full rounded-full transition-all duration-700"
                  style={{ width: `${progressInLevel}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[10px] text-stone-400">
                <span>Nivel {userProfile.level}</span>
                <span>{Math.round(progressInLevel)}% hacia Nivel {Math.min(5, userProfile.level + 1)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Past Mistakes & Watchlist (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-stone-900 text-sm sm:text-base">
                Tendencias y Errores a Vigilar
              </h3>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Cosas que te suelen pasar cocinando. El Chef IA las tiene presentes para recordarte cómo evitarlas antes de encender el fuego:
            </p>

            {/* List of past mistakes */}
            <div className="space-y-2">
              {userProfile.pastMistakes.length === 0 ? (
                <div className="text-center p-4 bg-stone-50 rounded-xl text-stone-400 text-xs">
                  Aún no has registrado errores. ¡Cocina tu primer plato para empezar tu aprendizaje!
                </div>
              ) : (
                userProfile.pastMistakes.map((mistake, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-center justify-between text-xs text-amber-950 font-medium"
                  >
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>{mistake}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveMistake(mistake)}
                      className="text-stone-400 hover:text-red-500 p-1 rounded"
                      title="Eliminar error ya superado"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add custom mistake input */}
            <div className="pt-2 border-t border-stone-100 flex gap-2">
              <input
                type="text"
                value={newMistakeInput}
                onChange={(e) => setNewMistakeInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddMistake()}
                placeholder="Anotar tendencia (ej: olvido apagar a tiempo)..."
                className="flex-1 px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                onClick={handleAddMistake}
                disabled={!newMistakeInput.trim()}
                className="px-3 py-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir</span>
              </button>
            </div>
          </div>

          {/* Badges card */}
          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-stone-900 text-sm sm:text-base">
                Insignias Culinarias
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {userProfile.unlockedBadges.map((b) => (
                <div
                  key={b.id}
                  className="p-3 bg-stone-50 border border-stone-200 rounded-xl flex flex-col items-center text-center space-y-1"
                >
                  <span className="text-2xl">{b.icon}</span>
                  <span className="text-xs font-bold text-stone-900">{b.title}</span>
                  <span className="text-[10px] text-stone-500 leading-tight">
                    {b.description}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Cooking History (7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 sm:p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold text-stone-900 text-base">
                Historial de Platos Cocinados ({userProfile.cookedHistory.length})
              </h3>
            </div>
            <span className="text-xs text-stone-500">Evaluaciones guardadas</span>
          </div>

          {userProfile.cookedHistory.length === 0 ? (
            <div className="text-center p-12 text-stone-400 space-y-2">
              <p className="text-sm font-semibold">Aún no has preparado ninguna receta guiada.</p>
              <p className="text-xs">Ve a la pestaña "Modo Cocinar", sigue un plato y completa tu primera evaluación.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {userProfile.cookedHistory.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 space-y-2 hover:bg-stone-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-stone-900">{item.recipeTitle}</h4>
                    <span className="text-[11px] text-stone-400">{item.date}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 text-[11px] font-semibold rounded-full">
                      Resultado: {item.rating}
                    </span>
                    <span className="px-2.5 py-0.5 bg-stone-200 text-stone-700 text-[11px] rounded-full">
                      Mayor reto: {item.difficultyFaced}
                    </span>
                    <span className="text-[11px] text-emerald-700 font-bold ml-auto">
                      +{item.xpEarned} XP
                    </span>
                  </div>

                  <div className="p-3 bg-white border border-stone-200 rounded-lg text-xs text-stone-700 leading-relaxed">
                    <strong className="text-amber-800 font-semibold block mb-0.5">
                      Consejo del Chef Mentor:
                    </strong>
                    {item.mentorTip}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
