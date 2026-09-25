import React, { useState, useRef } from 'react';
import { UserProfile, FlavorBooster, CULINARY_LEVELS } from '../types';
import {
  Award,
  BookOpen,
  AlertTriangle,
  Flame,
  Star,
  Sparkles,
  Plus,
  CheckCircle2,
  Download,
  Upload,
  ChefHat,
  Heart,
  Compass,
  Zap,
  Coins,
} from 'lucide-react';
import { TokenBudgetMonitor } from './TokenBudgetMonitor';

interface ChefNotebookProps {
  userProfile: UserProfile;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
  onLearnFact?: (category: 'fuego' | 'gustos' | 'equipamiento' | 'habito' | 'fortaleza', fact: string) => void;
  onRemoveFact?: (id: string) => void;
}

export const ChefNotebook: React.FC<ChefNotebookProps> = ({
  userProfile,
  onUpdateProfile,
  onLearnFact,
  onRemoveFact,
}) => {
  const [newMistakeInput, setNewMistakeInput] = useState('');
  const [newSkillInput, setNewSkillInput] = useState('');
  const [newBoosterDish, setNewBoosterDish] = useState('');
  const [newBoosterTip, setNewBoosterTip] = useState('');
  const [newMemoryCategory, setNewMemoryCategory] = useState<'fuego' | 'gustos' | 'equipamiento' | 'habito' | 'fortaleza'>('gustos');
  const [newMemoryFact, setNewMemoryFact] = useState('');
  const [showAddBooster, setShowAddBooster] = useState(false);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentLevelMeta = CULINARY_LEVELS.find((l) => l.level === userProfile.level) || CULINARY_LEVELS[0];
  const nextLevelMeta = CULINARY_LEVELS.find((l) => l.level === userProfile.level + 1) || null;
  const progressInLevel = Math.min(
    100,
    Math.max(0, ((userProfile.xp - currentLevelMeta.minXp) / Math.max(1, currentLevelMeta.targetXp - currentLevelMeta.minXp)) * 100)
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

  const handleAddSkill = () => {
    if (!newSkillInput.trim()) return;
    const currentSkills = userProfile.masteredSkills || [];
    if (!currentSkills.includes(newSkillInput.trim())) {
      onUpdateProfile({
        masteredSkills: [...currentSkills, newSkillInput.trim()],
      });
    }
    setNewSkillInput('');
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    onUpdateProfile({
      masteredSkills: (userProfile.masteredSkills || []).filter((s) => s !== skillToRemove),
    });
  };

  const handleAddBooster = () => {
    if (!newBoosterTip.trim()) return;
    const newBooster: FlavorBooster = {
      dish: newBoosterDish.trim() || 'Plato general',
      tip: newBoosterTip.trim(),
      category: 'acidez',
      date: 'Hoy',
    };
    onUpdateProfile({
      flavorBoostersLearned: [newBooster, ...(userProfile.flavorBoostersLearned || [])],
    });
    setNewBoosterDish('');
    setNewBoosterTip('');
    setShowAddBooster(false);
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
            masteredSkills: Array.isArray(parsed.masteredSkills) ? parsed.masteredSkills : userProfile.masteredSkills,
            flavorPreferences: Array.isArray(parsed.flavorPreferences) ? parsed.flavorPreferences : userProfile.flavorPreferences,
            flavorBoostersLearned: Array.isArray(parsed.flavorBoostersLearned) ? parsed.flavorBoostersLearned : userProfile.flavorBoostersLearned,
            aiToneSetting: parsed.aiToneSetting || userProfile.aiToneSetting,
            complexityLevel: parsed.complexityLevel || userProfile.complexityLevel,
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

  const getToneLabel = (tone: string | undefined) => {
    switch (tone) {
      case 'chef_creativo':
        return {
          title: 'Chef Creativo & Audaz',
          desc: 'El mentor te sugiere toques atrevidos, sustituciones de autor y te otorga mayor autonomía.',
          badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        };
      case 'complice_culinario':
        return {
          title: 'Cómplice Culinario',
          desc: 'Instrucciones dinámicas y fluidas, con consejos prácticos para afinar el punto de cocción.',
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        };
      default:
        return {
          title: 'Mentor Paciente & Seguro',
          desc: 'Explicaciones paso a paso, recordatorios preventivos de seguridad y refuerzo positivo.',
          badge: 'bg-amber-400/20 text-amber-300 border-amber-400/30',
        };
    }
  };

  const activeTone = getToneLabel(userProfile.aiToneSetting);

  return (
    <div className="space-y-6">
      {/* Profile Header & Skill Level Progression */}
      <div className="bg-gradient-to-r from-stone-900 to-stone-800 text-white p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-10 translate-y-10">
          <BookOpen className="w-80 h-80 text-white" />
        </div>

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold border border-amber-400/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Memoria Evolutiva de Cocina</span>
            </div>

            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${activeTone.badge}`}>
              <ChefHat className="w-3.5 h-3.5" />
              <span>Tono IA: {activeTone.title}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold font-serif">
                Mi Cuaderno de Chef
              </h2>
              <p className="text-xs sm:text-sm text-stone-300 mt-1 max-w-xl">
                Gemini lee este cuaderno en cada receta para adaptarse a tus destrezas, advertirte sobre errores pasados (como el fuego alto o el ajo quemado) y proponerte potenciadores de sabor.
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
                  <span className="text-xl">{currentLevelMeta.badge}</span>
                  {currentLevelMeta.title}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-stone-400 block">Experiencia Acumulada</span>
                <span className="text-sm font-bold font-mono text-amber-300">
                  {userProfile.xp} / {currentLevelMeta.targetXp} XP
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
                <span>{currentLevelMeta.shortTitle}</span>
                <span>
                  {nextLevelMeta
                    ? `${Math.round(progressInLevel)}% hacia ${nextLevelMeta.shortTitle}`
                    : '¡Nivel Máximo alcanzado!'}
                </span>
              </div>
            </div>
          </div>

          {/* Relationship Evolution Info */}
          <div className="p-3 rounded-xl bg-stone-800/60 border border-stone-700/60 flex items-start gap-2.5 text-xs text-stone-300">
            <Compass className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white">Evolución de tu Mentor:</strong> {activeTone.desc}
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Skills, Boosters & Mistakes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Skills & Mistakes (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Micro-Habilidades Dominadas */}
          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-stone-900 text-sm sm:text-base">
                  Habilidades Dominadas ({(userProfile.masteredSkills || []).length})
                </h3>
              </div>
            </div>

            <p className="text-xs text-stone-600">
              Técnicas que ya tienes bajo control. El mentor las da por sabidas para enfocarse en nuevos aprendizajes:
            </p>

            <div className="flex flex-wrap gap-2">
              {(userProfile.masteredSkills || []).map((skill, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-semibold"
                >
                  <span>✓</span>
                  <span>{skill}</span>
                  <button
                    onClick={() => handleRemoveSkill(skill)}
                    className="text-emerald-500 hover:text-emerald-800 ml-1"
                    title="Eliminar habilidad"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="pt-2 border-t border-stone-100 flex gap-2">
              <input
                type="text"
                value={newSkillInput}
                onChange={(e) => setNewSkillInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSkill()}
                placeholder="Añadir técnica (ej: Saltear sin humear)..."
                className="flex-1 px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                onClick={handleAddSkill}
                disabled={!newSkillInput.trim()}
                className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir</span>
              </button>
            </div>
          </div>

          {/* Memoria Culinaria Evolutiva del Chef IA */}
          <div className="bg-gradient-to-br from-amber-500/10 via-white to-amber-500/5 p-5 rounded-2xl border border-amber-300/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-bold">
                  🧠
                </div>
                <div>
                  <h3 className="font-bold text-stone-900 text-sm sm:text-base flex items-center gap-1.5">
                    <span>Memoria Culinaria Evolutiva</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900">
                      {userProfile.evolutionaryMemories?.length || 0} aprendizajes
                    </span>
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Lo que el Chef Mentor ha aprendido observando tus cocciones y charlas
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs text-stone-700 leading-relaxed bg-white/70 p-3 rounded-xl border border-amber-200/60">
              💡 <strong>La IA evoluciona contigo:</strong> En cada interacción por voz o receta completada, el Chef detecta tus utensilios reales, tus preferencias y los puntos de cocción donde necesitas más calma para personalizar cada consejo.
            </p>

            {/* List of learned memories */}
            <div className="space-y-2">
              {(!userProfile.evolutionaryMemories || userProfile.evolutionaryMemories.length === 0) ? (
                <div className="text-center p-4 bg-white/60 rounded-xl text-stone-400 text-xs italic border border-dashed border-stone-300">
                  Aún no hay memorias aprendidas. Háblale al Chef en el modo cocina o cocina tu primera receta.
                </div>
              ) : (
                userProfile.evolutionaryMemories.map((mem) => (
                  <div
                    key={mem.id}
                    className="p-3 bg-white border border-amber-200 rounded-xl flex items-start justify-between gap-2 shadow-2xs hover:border-amber-300 transition"
                  >
                    <div className="flex items-start gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 bg-amber-100 text-amber-900 border border-amber-200">
                        {mem.category === 'fuego' && '🔥 Control de Fuego'}
                        {mem.category === 'fortaleza' && '⭐ Fortaleza'}
                        {mem.category === 'gustos' && '🧂 Gusto / Sabor'}
                        {mem.category === 'equipamiento' && '🍳 Equipamiento'}
                        {mem.category === 'habito' && '💡 Hábito'}
                        {!['fuego', 'fortaleza', 'gustos', 'equipamiento', 'habito'].includes(mem.category) && mem.category}
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-stone-800 leading-snug">{mem.fact}</p>
                        <span className="text-[10px] text-stone-400 font-medium">Aprendido: {mem.learnedAt}</span>
                      </div>
                    </div>
                    {onRemoveFact && (
                      <button
                        onClick={() => onRemoveFact(mem.id)}
                        className="text-stone-400 hover:text-red-600 p-1 rounded transition"
                        title="Olvidar esta memoria"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Enseñar un dato manualmente al Chef */}
            <div className="pt-2 border-t border-amber-200/80 space-y-2">
              <span className="text-[11px] font-bold text-stone-700 block">
                ¿Quieres enseñarle algo específico sobre tu cocina?
              </span>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={newMemoryCategory}
                  onChange={(e) => setNewMemoryCategory(e.target.value as any)}
                  className="px-2.5 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="gustos">🧂 Gusto / Dieta</option>
                  <option value="equipamiento">🍳 Sartén / Estufa</option>
                  <option value="fuego">🔥 Control de Fuego</option>
                  <option value="fortaleza">⭐ Fortaleza</option>
                  <option value="habito">💡 Hábito personal</option>
                </select>
                <input
                  type="text"
                  value={newMemoryFact}
                  onChange={(e) => setNewMemoryFact(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newMemoryFact.trim() && onLearnFact) {
                      onLearnFact(newMemoryCategory, newMemoryFact.trim());
                      setNewMemoryFact('');
                    }
                  }}
                  placeholder="Ej: Solo cocino con sartén de 20cm, soy sensible a la pimienta..."
                  className="flex-1 px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  onClick={() => {
                    if (newMemoryFact.trim() && onLearnFact) {
                      onLearnFact(newMemoryCategory, newMemoryFact.trim());
                      setNewMemoryFact('');
                    }
                  }}
                  disabled={!newMemoryFact.trim()}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Enseñar</span>
                </button>
              </div>
            </div>
          </div>

          {/* Past Mistakes & Watchlist */}
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

          {/* Flavor Boosters Aprendidos */}
          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-orange-500" />
                <h3 className="font-bold text-stone-900 text-sm sm:text-base">
                  Potenciadores de Sabor (Flavor Boosters)
                </h3>
              </div>
              <button
                onClick={() => setShowAddBooster(!showAddBooster)}
                className="text-xs text-orange-600 font-bold hover:underline"
              >
                {showAddBooster ? 'Cerrar' : '+ Añadir truco'}
              </button>
            </div>

            <p className="text-xs text-stone-600">
              Pequeños secretos aprendidos tras cada preparación para transformar platos simples en comida memorable:
            </p>

            {showAddBooster && (
              <div className="p-3 bg-orange-50/70 border border-orange-200 rounded-xl space-y-2 text-xs">
                <input
                  type="text"
                  placeholder="¿En qué plato lo aprendiste? (ej: Huevos revueltos)"
                  value={newBoosterDish}
                  onChange={(e) => setNewBoosterDish(e.target.value)}
                  className="w-full p-2 bg-white border border-stone-300 rounded-lg"
                />
                <textarea
                  placeholder="El secreto de sabor (ej: Unas gotas de limón al apagar el fuego...)"
                  value={newBoosterTip}
                  onChange={(e) => setNewBoosterTip(e.target.value)}
                  rows={2}
                  className="w-full p-2 bg-white border border-stone-300 rounded-lg"
                />
                <button
                  onClick={handleAddBooster}
                  disabled={!newBoosterTip.trim()}
                  className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg text-xs"
                >
                  Guardar en Cuaderno
                </button>
              </div>
            )}

            <div className="space-y-2">
              {(!userProfile.flavorBoostersLearned || userProfile.flavorBoostersLearned.length === 0) ? (
                <div className="text-center p-4 bg-stone-50 rounded-xl text-stone-400 text-xs">
                  Completa recetas en el Modo Cocinar para desbloquear potenciadores de sabor.
                </div>
              ) : (
                userProfile.flavorBoostersLearned.map((b, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-gradient-to-r from-orange-50/80 to-amber-50/50 border border-orange-200/80 rounded-xl text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold text-orange-950">
                      <span>✨ {b.dish}</span>
                      <span className="text-stone-400 font-normal">{b.date}</span>
                    </div>
                    <p className="text-stone-700">{b.tip}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Preferencias de Paladar Detectadas */}
          {userProfile.flavorPreferences && userProfile.flavorPreferences.length > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-2">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-rose-500" />
                <h3 className="font-bold text-stone-900 text-sm sm:text-base">
                  Tus Preferencias de Paladar
                </h3>
              </div>
              <p className="text-xs text-stone-600">
                Rasgos de sabor que tu mentor identifica en tus preparaciones:
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {userProfile.flavorPreferences.map((pref, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 bg-rose-50 text-rose-900 border border-rose-200 rounded-full text-xs font-semibold"
                  >
                    👅 {pref}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sección de Transparencia de Recursos y Presupuesto Live */}
          <TokenBudgetMonitor
            compact={false}
            showTips={true}
          />

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

                  {/* Badges for micro-skill & flavor booster learned in this dish */}
                  {(item.skillImproved || item.flavorBoosterLearned) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                      {item.skillImproved && (
                        <div className="p-2 rounded-lg bg-emerald-50/80 border border-emerald-200 text-emerald-900">
                          <strong className="block text-[10px] uppercase text-emerald-700 font-bold">Habilidad practicada:</strong>
                          <span>{item.skillImproved}</span>
                        </div>
                      )}
                      {item.flavorBoosterLearned && (
                        <div className="p-2 rounded-lg bg-orange-50/80 border border-orange-200 text-orange-950">
                          <strong className="block text-[10px] uppercase text-orange-700 font-bold">Toque aprendido:</strong>
                          <span>{item.flavorBoosterLearned}</span>
                        </div>
                      )}
                    </div>
                  )}

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
