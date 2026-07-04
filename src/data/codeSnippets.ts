export interface CodeFile {
  name: string;
  language: string;
  code: string;
  description: string;
}

export const codeSnippets: CodeFile[] = [
  {
    name: "config.py",
    language: "python",
    description: "Ініціалізація бота, диспетчера, планувальника APScheduler та клієнта Supabase.",
    code: `# config.py
import os
import logging
from dotenv import load_dotenv
from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from supabase import create_client, Client

# Налаштування логування
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Завантажуємо змінні оточення
load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not BOT_TOKEN:
    raise ValueError("Помилка: BOT_TOKEN не знайдено в файлі .env!")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Помилка: SUPABASE_URL або SUPABASE_KEY відсутні в .env!")

# Ініціалізація об'єктів згідно з сучасним стандартом aiogram 3.x
bot = Bot(
    token=BOT_TOKEN, 
    default=DefaultBotProperties(parse_mode=ParseMode.HTML)
)
dp = Dispatcher()

# Планувальник для щоденного надсилання матеріалів
scheduler = AsyncIOScheduler(timezone="Europe/Kyiv")

# Клієнт Supabase для хмарної бази даних
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
`
  },
  {
    name: "database.py",
    language: "python",
    description: "Робота з базою даних Supabase. Отримання статусів, додавання користувачів, зміна статусу оплати.",
    code: `# database.py
import logging
from datetime import datetime
from config import supabase

logger = logging.getLogger(__name__)

def init_db():
    """Перевірка підключення до Supabase."""
    try:
        # Простий запит для перевірки з'єднання
        supabase.table("users").select("count", count="exact").limit(1).execute()
        logger.info("Підключення до Supabase успішне.")
    except Exception as e:
        logger.error(f"Помилка ініціалізації Supabase: {e}", exc_info=True)

def add_user(user_id: int, username: str):
    """Додавання нового користувача або ігнорування, якщо вже існує."""
    try:
        user_id_str = str(user_id)
        existing = supabase.table("users").select("user_id").eq("user_id", user_id_str).execute()
        
        if not existing.data:
            supabase.table("users").insert({
                "user_id": user_id_str,
                "username": username or f"User_{user_id}",
                "status": "free", # за замовчуванням безкоштовний
                "current_day": 1,
                "join_date": datetime.now().isoformat(),
                "last_active": datetime.now().isoformat()
            }).execute()
            logger.info(f"Новий користувач {username} ({user_id_str}) успішно зареєстрований.")
        else:
            # Оновлюємо час останньої активності
            supabase.table("users").update({
                "last_active": datetime.now().isoformat()
            }).eq("user_id", user_id_str).execute()
    except Exception as e:
        logger.error(f"Помилка при реєстрації користувача в Supabase: {e}", exc_info=True)

def update_user_status(user_id: int, status: str):
    """Оновлення статусу підписки користувача (free, base, support, vip)."""
    try:
        user_id_str = str(user_id)
        supabase.table("users").update({
            "status": status,
            "last_active": datetime.now().isoformat()
        }).eq("user_id", user_id_str).execute()
        logger.info(f"Користувач {user_id_str} отримав статус: {status}")
        return True
    except Exception as e:
        logger.error(f"Помилка оновлення статусу {user_id}: {e}")
        return False

def update_user_day(user_id: int, day: int):
    """Оновлення поточного дня проходження курсу."""
    try:
        user_id_str = str(user_id)
        supabase.table("users").update({
            "current_day": day,
            "last_active": datetime.now().isoformat()
        }).eq("user_id", user_id_str).execute()
        logger.info(f"Користувачу {user_id_str} встановлено день {day}")
    except Exception as e:
        logger.error(f"Помилка оновлення дня для {user_id}: {e}")

def get_user_data(user_id: int):
    """Отримання повної інформації про користувача."""
    try:
        user_id_str = str(user_id)
        response = supabase.table("users").select("*").eq("user_id", user_id_str).execute()
        if response.data:
            return response.data[0]
        return None
    except Exception as e:
        logger.error(f"Помилка отримання даних {user_id}: {e}")
        return None

def get_users_by_status(status_list: list):
    """Отримання списку користувачів за певними статусами."""
    try:
        response = supabase.table("users").select("*").in_("status", status_list).execute()
        return response.data or []
    except Exception as e:
        logger.error(f"Помилка отримання користувачів за статусом: {e}")
        return []

def get_all_packages():
    """Отримання тарифних планів для відображення в боті."""
    try:
        response = supabase.table("packages").select("*").order("id").execute()
        return response.data or []
    except Exception as e:
        logger.error(f"Помилка завантаження пакетів з бази: {e}")
        # Повертаємо статичний дефолт, якщо таблиця порожня
        return [
            {"id": "base", "name": "Самостійно", "tag": "Базовий", "price": "20€", "old_price": "100€", "desc_text": "Повне самостійне проходження практикуму", "features": ["8 відео-уроків", "8 аудіопрактик", "Робочий зошит", "Доступ назавжди"], "available_places": None},
            {"id": "support", "name": "Зі спікером", "tag": "Супровід", "price": "125€", "old_price": "200€", "desc_text": "Живий контакт і підтримка від Антоніни", "features": ["Група з учасницями", "Голосові відповіді від Антоніни", "1 Zoom-сесія", "Розбір запитів"], "available_places": 12},
            {"id": "vip", "name": "Індивідуально", "tag": "VIP Супровід", "price": "400€", "old_price": "600€", "desc_text": "Максимальна трансформація тет-а-тет", "features": ["4 особисті сесії Zoom", "Чат 24/7 зі спікером", "Індивідуальна карта практик"], "available_places": 3}
        ]
`
  },
  {
    name: "messages.py",
    language: "python",
    description: "Шаблони текстових повідомлень, описів бонусів та структура занять для 8 днів.",
    code: `# messages.py

START_MESSAGE = (
    "✨ <b>Вітаємо у боті курсу «Точка переходу» Антоніни Пашко!</b> ✨\\n\\n"
    "Тут ви будете отримувати важливі матеріали, аудіо-практики, відео-уроки та робочі зошити.\\n\\n"
    "<b>Про практикум:</b>\\n"
    "• 7+1 днів глибинної роботи\\n"
    "• 15-30 хвилин на день у вашому власному темпі\\n"
    "• Реальний внутрішній зсув без напруги та надриву\\n\\n"
    "🔑 <b>Ваш поточний статус:</b> Безкоштовний доступ (Ознайомча версія)\\n\\n"
    "Для отримання щоденних занять та повних матеріалів курсу, будь ласка, оберіть формат участі та оплатіть курс."
)

BONUSES_TEXT = (
    "🎁 <b>РАЗОМ ІЗ КУРСОМ ТИ ОТРИМУЄШ 3 ЦІННІ БОНУСИ:</b>\\n"
    "1️⃣ Авторська медитація <b>«Повернення до себе»</b> (15 хв) — повертає контакт із собою для щоденних ритуалів.\\n"
    "2️⃣ PDF-гайд <b>«Сила без напруги»</b> — 7 маркерів тотального контролю та 4 практичні вправи.\\n"
    "3️⃣ PDF-інтенсив <b>«7 ознак, що ти заслуговуєш свою цінність»</b> — вихід із пастки постійного бігу за результатом.\\n\\n"
    "⚠️ <i>*Спеціальна ціна активована тільки для першого потоку!</i>\\n\\n"
    "👇 <b>Обери свій формат нижче на кнопках для миттєвої активації:</b>"
)

PAYMENT_SUCCESS_TEXT = (
    "🎉 <b>ОПЛАТА УСПІШНА! Ласкаво просимо в «Точку переходу»!</b> 🎉\\n\\n"
    "Вітаємо! Ваш платіж зараховано, а преміум-доступ до матеріалів <b>активовано назавжди</b>.\\n\\n"
    "<b>Відтепер ви будете отримувати:</b>\\n"
    "• 🎬 8 авторських відео-уроків Антоніни Пашко\\n"
    "• 🎵 8 трансформаційних аудіо-практик у високій якості\\n"
    "• 📄 Робочі зошити для щоденної чесної розмови із собою\\n\\n"
    "🚀 Перше заняття (День 1) вже надіслано вам нижче! Рухайтесь у зручному для вас темпі. Старт розпочато!"
)

# Описи занять для розсилки (для преміум-користувачів)
DAYS_CONTENT = {
    1: {
        "title": "День 1. Я не втратила мотивацію. Я переросла.",
        "text": (
            "🎬 <b>День 1. Я не втратила мотивацію. Я переросла.</b>\\n\\n"
            "Побачити, що ти не в тупику, а на порозі нового етапу. З тобою все гаразд. "
            "Колись твоя сила та вміння витримувати допомогли тобі вижити, але сьогодні вони забирають твою живість.\\n\\n"
            "👇 Завантажуйте робочий зошит, дивіться відео та слухайте аудіо-практику:"
        ),
        "video_file_id": "BAACAgIAAxkBAAMvajVI75mh0hVpuPrEpXgLuDixMLQAAgWcAAKKmKBJXYmsIoCHVgY8BA",
        "audio_name": "1 день «Точка ПЕРЕХОДУ».m4a",
        "pdfs": ["1 Практика Моє чуже2.pdf", "1 Практика Моє чуже3.pdf"]
    },
    2: {
        "title": "День 2. Що насправді забирає мою енергію.",
        "text": (
            "🎬 <b>День 2. Що насправді забирає мою енергію.</b>\\n\\n"
            "Сьогодні ми знайдемо реальні джерела ресурсу в твоєму дні, а не спишемо все на абстрактну втому.\\n\\n"
            "👇 Ваші матеріали на сьогодні:"
        ),
        "video_file_id": "BAACAgIAAxkBAAMvajVI75mh0hVpuPrEpXgLuDixMLQAAgWcAAKKmKBJXYmsIoCHVgY8BB",
        "audio_name": "2 день «Аналіз витоків ресурсу».m4a",
        "pdfs": ["2 Робочий зошит - Енергетичний аудит.pdf"]
    },
    3: {
        "title": "День 3. Що я тримаю — і боюсь відпустити.",
        "text": (
            "🎬 <b>День 3. Що я тримаю — і боюсь відпустити.</b>\\n\\n"
            "Побачити ціну утримання старого та чесно назвати свій страх змін.\\n\\n"
            "👇 Забирайте матеріали 3-го дня:"
        ),
        "video_file_id": "BAACAgIAAxkBAAMvajVI75mh0hVpuPrEpXgLuDixMLQAAgWcAAKKmKBJXYmsIoCHVgY8BC",
        "audio_name": "3 день «Робота з прив'язаностями».m4a",
        "pdfs": ["3 Робочий зошит - Страхи і відпускання.pdf"]
    },
    4: {
        "title": "День 4. Зустріч із собою справжньою.",
        "text": (
            "🎬 <b>День 4. Зустріч із собою справжньою.</b>\\n\\n"
            "Почути себе за межами соціальних ролей, очікувань і нескінченного 'треба'.\\n\\n"
            "👇 Ваші матеріали дня:"
        ),
        "video_file_id": "BAACAgIAAxkBAAMvajVI75mh0hVpuPrEpXgLuDixMLQAAgWcAAKKmKBJXYmsIoCHVgY8BD",
        "audio_name": "4 день «Повернення до себе».m4a",
        "pdfs": ["4 Робочий зошит - Моє справжнє Я.pdf"]
    },
    5: {
        "title": "День 5. Точка відчаю.",
        "text": (
            "🎬 <b>День 5. Точка відчаю.</b>\\n\\n"
            "Як не загубити себе в лімінальному просторі «між» старим і новим. Твій новий, надзвичайно глибокий урок.\\n\\n"
            "👇 Забирайте матеріали:"
        ),
        "video_file_id": "BAACAgIAAxkBAAMvajVI75mh0hVpuPrEpXgLuDixMLQAAgWcAAKKmKBJXYmsIoCHVgY8BE",
        "audio_name": "5 день «Точка відчаю».m4a",
        "pdfs": ["5 Робочий зошит - Простір між світами.pdf"]
    },
    6: {
        "title": "День 6. Чому я не дозволяю собі більшого.",
        "text": (
            "🎬 <b>День 6. Чому я не дозволяю собі більшого.</b>\\n\\n"
            "Розпізнати внутрішню стелю, core beliefs та переконання, які обмежують твій наступний рівень життєвої свободи.\\n\\n"
            "👇 Матеріали шостого дня:"
        ),
        "video_file_id": "BAACAgIAAxkBAAMvajVI75mh0hVpuPrEpXgLuDixMLQAAgWcAAKKmKBJXYmsIoCHVgY8BF",
        "audio_name": "6 день «Внутрішня стеля».m4a",
        "pdfs": ["6 Робочий зошит - Переконання і рамки.pdf"]
    },
    7: {
        "title": "День 7. Рішення вже є. Я просто боюсь його почути.",
        "text": (
            "🎬 <b>День 7. Рішення вже є. Я просто боюсь його почути.</b>\\n\\n"
            "Як розрізнити страх і справжнє «ні», увімкнути тілесний відгук і тотально довіритись собі.\\n\\n"
            "👇 Передостанній крок до себе:"
        ),
        "video_file_id": "BAACAgIAAxkBAAMvajVI75mh0hVpuPrEpXgLuDixMLQAAgWcAAKKmKBJXYmsIoCHVgY8BG",
        "audio_name": "7 день «Рішення серцем».m4a",
        "pdfs": ["7 Робочий зошит - Тілесний інтелект.pdf"]
    },
    8: {
        "title": "День 8. Інтеграція та фінал. Що змінюється, коли змінюєшся ти.",
        "text": (
            "🎬 <b>День 8. Інтеграція та фінал. Що змінюється, коли змінюєшся ти.</b>\\n\\n"
            "Вітаємо із проходженням цього шляху! Сьогодні ми проводимо інтеграцію всього тижня, ставимо захист від нейросаботажу та робимо твій перший чесний крок.\\n\\n"
            "👇 Твій фінальний робочий інструментарій:"
        ),
        "video_file_id": "BAACAgIAAxkBAAMvajVI75mh0hVpuPrEpXgLuDixMLQAAgWcAAKKmKBJXYmsIoCHVgY8BH",
        "audio_name": "8 день «Лист у майбутнє».m4a",
        "pdfs": ["8 Робочий зошит - Збірка та інтеграція.pdf"]
    }
}

def build_offer_message(packages_data: list) -> str:
    """Динамічно збирає гарний HTML-текст пропозиції на основі даних з бази."""
    text = "<b>✨ ОБЕРИ ФОРМАТ, У ЯКОМУ ТОБІ БУДЕ БЕЗПЕЧНО РУХАТИСЯ ✨</b>\\n\\n"
    text += "Не залишайся осторонь трансформації! Ознайомся з тарифами 7-денного онлайн-практикуму <b>«Точка переходу»</b>:\\n\\n"
    
    icons = {"base": "📦", "support": "🤝", "vip": "💎"}
    
    for pkg in packages_data:
        p_id = pkg.get('id')
        icon = icons.get(p_id, "🌟")
        places_str = ""
        if pkg.get('available_places') is not None:
            places_str = f" — 🚨 <i>Залишилось місць: <b>{pkg['available_places']}</b></i>"
            
        text += f"{icon} <b>{pkg['name'].upper()} ({pkg['tag']})</b>\\n"
        text += f"• <i>{pkg['desc_text']}</i>\\n"
        text += "• <b>Що входить:</b> " + ", ".join(pkg.get('features', [])) + ".\\n"
        text += f"• 🔥 <b>Ціна: {pkg['price']}</b> (замість <s>{pkg['old_price']}</s>){places_str}\\n\\n"
        
    text += BONUSES_TEXT
    return text
`
  },
  {
    name: "handlers.py",
    language: "python",
    description: "Обробники команд, кнопок оплати, імітація процесу купівлі та захищене відправлення контенту.",
    code: `# handlers.py
import os
import logging
from aiogram import Router, types, Bot
from aiogram.filters import Command, CommandStart
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo, FSInputFile

from database import add_user, get_user_data, get_all_packages, update_user_status
from messages import START_MESSAGE, build_offer_message, DAYS_CONTENT, PAYMENT_SUCCESS_TEXT

logger = logging.getLogger(__name__)
router = Router()

def get_styled_keyboard(packages_data: list) -> InlineKeyboardMarkup:
    """Створює ультра-помітні кнопки для оплати тарифів та зв'язку."""
    inline_keyboard = []
    
    # 1. Головна кнопка-WebApp для детального сайту всередині Telegram
    inline_keyboard.append([
        InlineKeyboardButton(
            text="✨ 🌐 ВІДКРИТИ САЙТ ПРЯМО ТУТ 🌐 ✨", 
            web_app=WebAppInfo(url="https://www.tonypashko.com/")
        )
    ])
    
    # 2. Кнопки вибору тарифів
    icons = {"base": "💳", "support": "🤝", "vip": "👑"}
    for pkg in packages_data:
        p_id = pkg['id']
        icon = icons.get(p_id, "👉")
        btn_text = f"{icon} {pkg['name']} — {pkg['price']}"
        # Для реального бота тут буде посилання на платіжну систему або callback
        inline_keyboard.append([
            InlineKeyboardButton(
                text=btn_text, 
                callback_data=f"buy_pkg_{p_id}"
            )
        ])
        
    # 3. Кнопка зв'язку в Інстаграм
    inline_keyboard.append([
        InlineKeyboardButton(
            text="💬 Написати Антоніні в Instagram", 
            url="https://www.instagram.com/tonypashko"
        )
    ])
    
    return InlineKeyboardMarkup(inline_keyboard=inline_keyboard)

@router.message(CommandStart())
async def cmd_start(message: types.Message, bot: Bot):
    """Обробка команди /start."""
    user_id = message.from_user.id
    username = message.from_user.username or message.from_user.first_name
    
    # Реєстрація у базі даних (Supabase)
    add_user(user_id, username)
    
    # Перевіряємо статус користувача
    user_data = get_user_data(user_id)
    status = user_data.get("status", "free") if user_data else "free"
    
    if status != "free":
        # Якщо вже оплачено, відправляємо привітання та поточний матеріал
        await message.answer(
            f"🌟 <b>Вітаємо з поверненням, {username}!</b>\\n\\n"
            f"Ваш тариф: <b>{status.upper()}</b>. Ви маєте повний доступ до всіх 8 днів практикуму.",
            parse_mode="HTML"
        )
        await send_day_content(bot, user_id, user_data.get("current_day", 1))
        return

    # Надсилаємо вітання безкоштовному користувачу
    await message.answer(START_MESSAGE, parse_mode="HTML")
    
    # Підтягуємо тарифи та надсилаємо оформлений оффер з кнопками
    packages_data = get_all_packages()
    if packages_data:
        offer_html = build_offer_message(packages_data)
        reply_markup = get_styled_keyboard(packages_data)
        
        await bot.send_message(
            chat_id=user_id,
            text=offer_html,
            parse_mode="HTML",
            reply_markup=reply_markup,
            disable_web_page_preview=True,
            protect_content=True # ЗАХИСТ ВІД КОПІЮВАННЯ ТА ПЕРЕСИЛАННЯ
        )

@router.callback_query(lambda c: c.data.startswith("buy_pkg_"))
async def process_payment_mock(callback_query: types.CallbackQuery, bot: Bot):
    """Емуляція успішного прийому оплати."""
    pkg_id = callback_query.data.replace("buy_pkg_", "")
    user_id = callback_query.from_user.id
    
    # Оновлюємо статус у Supabase
    update_user_status(user_id, pkg_id)
    
    # Повідомляємо у спливаючому вікні ТГ
    await callback_query.answer("Оплата обробляється... Успішно!", show_alert=True)
    
    # Надсилаємо велике святкове повідомлення про успішну покупку
    await bot.send_message(
        chat_id=user_id,
        text=PAYMENT_SUCCESS_TEXT,
        parse_mode="HTML"
    )
    
    # Одразу надсилаємо перший день
    await send_day_content(bot, user_id, 1)

async def send_day_content(bot: Bot, user_id: int, day: int):
    """Захищене відправлення матеріалів занять для платних учасників."""
    if day not in DAYS_CONTENT:
        logger.warning(f"Запитуваний день {day} відсутній в контенті.")
        return
        
    day_data = DAYS_CONTENT[day]
    logger.info(f"Надсилання Дня {day} користувачу {user_id}")
    
    # 1. Надсилаємо основний текст із захистом від пересилання
    await bot.send_message(
        chat_id=user_id,
        text=day_data["text"],
        parse_mode="HTML",
        protect_content=True
    )
    
    # 2. Надсилаємо відео за file_id (це надшвидко і економить трафік сервера)
    if day_data.get("video_file_id"):
        try:
            await bot.send_video(
                chat_id=user_id,
                video=day_data["video_file_id"],
                caption=f"🎬 Відео-урок — {day_data['title']}",
                protect_content=True
            )
        except Exception as e:
            logger.error(f"Помилка надсилання відео за file_id: {e}")
            await bot.send_message(
                chat_id=user_id,
                text="<i>*Відео завантажується на сервер... Ви можете знайти його за посиланням в особистому кабінеті.*</i>",
                parse_mode="HTML"
            )

    # 3. Надсилаємо аудіо-практику (локальний файл з папки /content)
    content_dir = os.path.join(os.path.dirname(__file__), "content")
    audio_path = os.path.join(content_dir, day_data["audio_name"])
    if os.path.exists(audio_path):
        try:
            audio_file = FSInputFile(audio_path, filename=day_data["audio_name"])
            await bot.send_audio(
                chat_id=user_id,
                audio=audio_file,
                caption=f"🎵 Аудіо-практика для Дня {day}",
                protect_content=True
            )
        except Exception as e:
            logger.error(f"Помилка надсилання аудіо: {e}")

    # 4. Надсилаємо Робочі зошити у форматі PDF
    for pdf_name in day_data.get("pdfs", []):
        pdf_path = os.path.join(content_dir, pdf_name)
        if os.path.exists(pdf_path):
            try:
                pdf_file = FSInputFile(pdf_path)
                await bot.send_document(
                    chat_id=user_id,
                    document=pdf_file,
                    caption=f"📄 Робочий зошит — {pdf_name}",
                    protect_content=True
                )
            except Exception as e:
                logger.error(f"Помилка надсилання PDF {pdf_name}: {e}")
`
  },
  {
    name: "main.py",
    language: "python",
    description: "Головна точка входу. Полінг бота та налаштування розкладу автоматичної розсилки через APScheduler.",
    code: `# main.py
import asyncio
import logging
from config import bot, dp, scheduler
from handlers import router as main_router
from database import init_db, get_users_by_status, update_user_day
from handlers import send_day_content

logger = logging.getLogger(__name__)

# Реєструємо головний роутер повідомлень
dp.include_router(main_router)

async def daily_course_broadcaster():
    """
    Щоденна функція розсилки.
    Запускається раз на добу. Перевіряє поточний день користувача,
    надсилає наступне заняття та інкрементує день.
    """
    logger.info("Початок автоматичної розсилки щоденних матеріалів...")
    
    # Отримуємо всіх користувачів з активною підпискою
    paid_statuses = ["base", "support", "vip"]
    active_students = get_users_by_status(paid_statuses)
    
    for student in active_students:
        user_id = int(student["user_id"])
        current_day = student.get("current_day", 1)
        
        # Якщо курс пройдено (більше 8 днів), ігноруємо
        if current_day > 8:
            continue
            
        try:
            # Надсилаємо матеріал поточного дня
            await send_day_content(bot, user_id, current_day)
            
            # Переводимо на наступний день у базі
            update_user_day(user_id, current_day + 1)
            
            # Захист від лімітів надсилання Telegram (30 повідомлень в секунду макс)
            await asyncio.sleep(0.05)
        except Exception as e:
            logger.error(f"Не вдалося надіслати матеріал дня {current_day} для {user_id}: {e}")

async def main():
    # 1. Перевірка бази даних
    init_db()
    
    # 2. Налаштування планувальника розсилок (кожен день о 09:00 ранку)
    scheduler.add_job(
        daily_course_broadcaster, 
        "cron", 
        hour=9, 
        minute=0,
        id="course_broadcast"
    )
    scheduler.start()
    logger.info("APScheduler успішно запущено. Наступна розсилка запланована на 09:00.")
    
    # 3. Початок отримання повідомлень (Long Polling)
    logger.info("Бот Антоніни Пашко заведений і готовий слухати команду /start!")
    try:
        await dp.start_polling(bot)
    finally:
        await bot.session.close()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Бот зупинений.")
`
  },
  {
    name: "requirements.txt",
    language: "plaintext",
    description: "Перелік необхідних бібліотек Python для розгортання бота.",
    code: `aiogram==3.15.0
supabase==2.10.0
apscheduler==3.10.4
python-dotenv==1.0.1
`
  }
];
