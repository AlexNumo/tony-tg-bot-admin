import { useState, useEffect } from 'react';
import { 
  BookOpen, Video, Music, FileText, Sparkles, Compass, 
  ArrowRight, ShieldCheck, Heart, UserCheck, Edit, Check, X, Save
} from 'lucide-react';
import { Lesson } from '../types';
import { lessonsData as fallbackLessons } from '../data/lessonsData';

interface CourseMaterialsProps {
  onSimulateDay: (dayNum: number) => void;
  lessons?: Lesson[];
  onUpdateLessons?: (newLessons: Lesson[]) => void;
}

export default function CourseMaterials({ onSimulateDay, lessons = fallbackLessons, onUpdateLessons }: CourseMaterialsProps) {
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Edit form states
  const [editTitle, setEditTitle] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editPracticeTitle, setEditPracticeTitle] = useState<string>('');
  const [editFullDescription, setEditFullDescription] = useState<string>('');
  const [editVideoDuration, setEditVideoDuration] = useState<string>('');
  const [editVideoFileId, setEditVideoFileId] = useState<string>('');
  const [editAudioFileName, setEditAudioFileName] = useState<string>('');

  const activeLesson = lessons.find(l => l.day === selectedDay) || lessons[0] || fallbackLessons[0];

  // Initialize edit form states when lesson changes or edit mode is entered
  useEffect(() => {
    if (activeLesson) {
      setEditTitle(activeLesson.title || '');
      setEditDescription(activeLesson.description || '');
      setEditPracticeTitle(activeLesson.practiceTitle || '');
      setEditFullDescription(activeLesson.fullDescription || '');
      setEditVideoDuration(activeLesson.videoDuration || '');
      setEditVideoFileId(activeLesson.videoFileId || '');
      setEditAudioFileName(activeLesson.audioFileName || '');
    }
  }, [activeLesson, isEditing]);

  const handleSave = () => {
    if (!onUpdateLessons) {
      alert("Редагування недоступне: відсутній обробник оновлення.");
      return;
    }

    const updatedLessons = lessons.map(l => {
      if (l.day === selectedDay) {
        return {
          ...l,
          title: editTitle,
          description: editDescription,
          practiceTitle: editPracticeTitle,
          fullDescription: editFullDescription,
          videoDuration: editVideoDuration,
          videoFileId: editVideoFileId,
          audioFileName: editAudioFileName
        };
      }
      return l;
    });

    onUpdateLessons(updatedLessons);
    setIsEditing(false);
  };

  return (
    <div id="course-materials-root" className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)] overflow-hidden">
      
      {/* 8 Days Navigation List */}
      <div id="days-nav-sidebar" className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col overflow-y-auto">
        <div className="border-b border-slate-800 pb-3 mb-4 flex items-center gap-2">
          <Compass className="w-5 h-5 text-amber-500 animate-spin-slow" />
          <div>
            <h3 className="font-display font-semibold text-sm text-white">Програма практикуму</h3>
            <span className="text-[10px] text-slate-400">7+1 днів, що повертають контакт із собою</span>
          </div>
        </div>

        <div className="space-y-2 flex-1">
          {lessons.map((lesson) => {
            const isSelected = selectedDay === lesson.day;
            return (
              <button
                key={lesson.day}
                onClick={() => {
                  setSelectedDay(lesson.day);
                  setIsEditing(false);
                }}
                className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 flex items-start gap-3.5 cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-r from-amber-500/10 to-amber-600/5 text-white border-amber-500'
                    : 'bg-slate-950 hover:bg-slate-850 text-slate-400 border-slate-850'
                }`}
              >
                <div className={`w-8 h-8 rounded-full font-display font-bold text-xs flex items-center justify-center shrink-0 border ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-lg shadow-amber-500/20'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}>
                  {lesson.day}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">День {lesson.day}</span>
                    {lesson.day === 5 && (
                      <span className="bg-rose-500/10 text-rose-400 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase border border-rose-500/10">Новий урок</span>
                    )}
                  </div>
                  <h4 className={`text-xs font-semibold truncate ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                    {lesson.title}
                  </h4>
                  <p className="text-[10px] text-slate-400 truncate mt-1">{lesson.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Day Content Detail Viewer / Editor */}
      <div id="day-detail-viewer" className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-xl p-6 flex flex-col justify-between overflow-y-auto">
        <div className="space-y-6">
          
          {/* Header information with Edit Toggle */}
          <div className="border-b border-slate-800 pb-5">
            <div className="flex items-center justify-between gap-4 mb-2">
              <div className="flex items-center gap-2">
                <span className="bg-amber-500/10 text-amber-400 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border border-amber-500/20">
                  День {activeLesson.day} практикуму
                </span>
                <span className="text-slate-500 text-xs font-mono">15-30 хв / день</span>
              </div>
              
              {onUpdateLessons && (
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                    isEditing 
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20' 
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850'
                  }`}
                >
                  {isEditing ? (
                    <>
                      <X className="w-3.5 h-3.5" />
                      <span>Скасувати</span>
                    </>
                  ) : (
                    <>
                      <Edit className="w-3.5 h-3.5 text-amber-400" />
                      <span>Редагувати текст дня</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-3 mt-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Заголовок заняття</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Короткий опис</label>
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2 mt-2">
                <h2 className="font-display font-bold text-xl lg:text-2xl text-white tracking-tight">
                  {activeLesson.title}
                </h2>
                <p className="text-sm text-slate-400 font-sans leading-relaxed">
                  {activeLesson.description}
                </p>
              </div>
            )}
          </div>

          {/* Form edit body or display body */}
          {isEditing ? (
            <div className="space-y-4 bg-slate-900/40 border border-slate-850 p-5 rounded-xl">
              <h3 className="font-display font-semibold text-xs text-white uppercase tracking-wider mb-2 flex items-center gap-2 text-amber-400">
                <Sparkles className="w-4 h-4" />
                Параметри контенту Telegram-бота
              </h3>

              <div className="space-y-3.5">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Повний опис (Відображається при виборі дня)</label>
                  <textarea
                    rows={4}
                    value={editFullDescription}
                    onChange={(e) => setEditFullDescription(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-white font-sans leading-relaxed focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Назва аудіо-практики</label>
                    <input
                      type="text"
                      value={editPracticeTitle}
                      onChange={(e) => setEditPracticeTitle(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Файл аудіо (.m4a)</label>
                    <input
                      type="text"
                      value={editAudioFileName}
                      onChange={(e) => setEditAudioFileName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Тривалість відео</label>
                    <input
                      type="text"
                      value={editVideoDuration}
                      onChange={(e) => setEditVideoDuration(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Telegram Video File ID (для реального бота)</label>
                    <input
                      type="text"
                      value={editVideoFileId}
                      onChange={(e) => setEditVideoFileId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center gap-2 border-t border-slate-800 mt-2">
                <button
                  onClick={handleSave}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2 px-4 rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Зберегти зміни програми</span>
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold py-2 px-4 rounded-lg text-xs transition-all cursor-pointer"
                >
                  Скасувати
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Psychological Paradigm: Transition & New Anchor */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl space-y-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-rose-400/80 block">Ілюзія контролю (Старе життя)</span>
                  <p className="text-xs text-slate-300 italic">
                    {activeLesson.day === 1 ? 'Щось закінчилося, але ще незрозуміло що саме.' : 
                     activeLesson.day === 2 ? 'Звичний відпочинок більше не повертає сили.' :
                     activeLesson.day === 3 ? 'Стало занадто складно зрозуміти, чого хочеться насправді.' :
                     activeLesson.day === 4 ? 'Важливі рішення роками відкладаються «на потім».' :
                     activeLesson.day === 5 ? 'Внутрішній крик: «Я більше не хочу і не буду так жити».' :
                     activeLesson.day === 6 ? 'Переконання: відпочинок треба заслужити, страшно розслабитись.' :
                     activeLesson.day === 7 ? 'Рішення роками відкладаються, страх почути власне «ні».' :
                     'Блок нейросаботажу: старі звички намагаються повернути контроль.'}
                  </p>
                </div>
                <div className="bg-emerald-950/10 border border-emerald-500/10 p-4 rounded-xl space-y-1">
                  <div className="flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 block">Нова опора (Трансформація)</span>
                  </div>
                  <p className="text-xs text-slate-300 font-medium">
                    {activeLesson.day === 1 ? 'Зи мною все гаразд — я на порозі масштабного нового.' : 
                     activeLesson.day === 2 ? 'Я чітко бачу, куди насправді витікає моя енергія.' :
                     activeLesson.day === 3 ? 'Я знову чую свій внутрішній голос та справжні бажання.' :
                     activeLesson.day === 4 ? 'Я тотально довіряю собі та дію без сумнівів.' :
                     activeLesson.day === 5 ? 'Я знаю свій наступний чесний, автономний крок.' :
                     activeLesson.day === 6 ? 'Я вільно дію без потреби постійно доводити свою корисність.' :
                     activeLesson.day === 7 ? 'Я вмію вмикати тілесний відгук і діяти з довіри.' :
                     'Лист собі: повна інтеграція та захист від повернення назад.'}
                  </p>
                </div>
              </div>

              {/* Full description if present */}
              {activeLesson.fullDescription && (
                <div className="space-y-1.5">
                  <h4 className="font-semibold text-xs text-slate-400 uppercase tracking-wider">Детальний зміст заняття:</h4>
                  <p className="text-xs text-slate-300 bg-slate-900/20 border border-slate-850/50 p-3.5 rounded-xl leading-relaxed whitespace-pre-wrap">
                    {activeLesson.fullDescription}
                  </p>
                </div>
              )}

              {/* Main materials list */}
              <div className="space-y-3">
                <h4 className="font-semibold text-xs text-slate-400 uppercase tracking-wider">Матеріали, що надсилає бот:</h4>
                
                <div className="space-y-2.5">
                  
                  {/* Video lesson */}
                  <div className="bg-slate-900 border border-slate-850 p-3.5 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center">
                        <Video className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-white block">Відео-урок Антоніни</span>
                        <span className="text-[10px] text-slate-400 block">Теорія та розбір механізмів • {activeLesson.videoDuration || '15-20 хв'}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">file_id: {activeLesson.videoFileId ? activeLesson.videoFileId.substring(0, 8) : '—'}...</span>
                  </div>

                  {/* Audio Practice */}
                  <div className="bg-slate-900 border border-slate-850 p-3.5 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center">
                        <Music className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-white block">{activeLesson.practiceTitle}</span>
                        <span className="text-[10px] text-slate-400 block">Аудіо-медитація та тілесна робота • {activeLesson.audioFileName || 'медіа'}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-sky-400 font-semibold bg-sky-950 px-2 py-0.5 rounded border border-sky-500/20">10-15 хв</span>
                  </div>

                  {/* Workbook PDFs */}
                  {activeLesson.pdfFiles && activeLesson.pdfFiles.map((pdfName, idx) => (
                    <div key={idx} className="bg-slate-900 border border-slate-850 p-3.5 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-white block">Робочий зошит (Практика PDF)</span>
                          <span className="text-[10px] text-slate-400 block">{pdfName}</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-500">1.4 MB</span>
                    </div>
                  ))}

                </div>
              </div>

              {/* Protection & Quality check */}
              <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 text-xs text-slate-400 space-y-2">
                <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Збереження авторського права в Telegram</span>
                </div>
                <p className="leading-relaxed">
                  Цей урок містить унікальні авторські практики. Бот розсилає ці PDF та аудіо-файли з увімкненим методом захисту від пересилання та скачування. Користувачі не зможуть зберегти матеріали на телефон, що мотивує їх проходити навчання безпосередньо у твоєму боті та гарантує цінність покупки.
                </p>
              </div>
            </>
          )}

        </div>

        {/* Action button to test in simulator (only visible when not editing) */}
        {!isEditing && (
          <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-slate-300">Бажаєте протестувати як цей матеріал надійде підписнику?</span>
            </div>
            <button
              onClick={() => onSimulateDay(activeLesson.day)}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2.5 px-5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.02]"
            >
              <span>Тестувати День {activeLesson.day} в боті</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>

    </div>
  );
}
