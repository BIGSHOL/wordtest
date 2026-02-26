"""Emoji Word Engine - maps English words to unambiguous emoji representations.

Only includes clear, 1:1 mappings. Ambiguous or multi-meaning words are excluded.
Used by mastery_engine to generate emoji_to_word question types.
"""

import random

# ─── Emoji Map ───────────────────────────────────────────────────────────────
# English word (lowercase) → emoji string
# Categories are for organization only; lookup is flat dict.

EMOJI_MAP: dict[str, str] = {
    # ── Animals ──
    "dog": "🐕",
    "cat": "🐱",
    "bird": "🐦",
    "fish": "🐟",
    "bear": "🐻",
    "rabbit": "🐰",
    "horse": "🐴",
    "pig": "🐷",
    "mouse": "🐭",
    "monkey": "🐵",
    "elephant": "🐘",
    "lion": "🦁",
    "tiger": "🐯",
    "whale": "🐋",
    "dolphin": "🐬",
    "shark": "🦈",
    "snake": "🐍",
    "frog": "🐸",
    "turtle": "🐢",
    "chicken": "🐔",
    "duck": "🦆",
    "owl": "🦉",
    "bee": "🐝",
    "butterfly": "🦋",
    "penguin": "🐧",
    "fox": "🦊",
    "wolf": "🐺",
    "deer": "🦌",
    "cow": "🐄",
    "sheep": "🐑",
    # goat — not in DB
    "camel": "🐪",
    "gorilla": "🦍",
    "zebra": "🦓",
    "giraffe": "🦒",
    "crocodile": "🐊",
    # octopus — not in DB
    "snail": "🐌",
    "ant": "🐜",
    # spider — not in DB
    "parrot": "🦜",
    # flamingo, peacock — not in DB
    "swan": "🦢",
    "eagle": "🦅",
    "crab": "🦀",
    "dinosaur": "🦕",
    "dragon": "🐉",
    "kangaroo": "🦘",
    "koala": "🐨",
    "mosquito": "🦟",
    "panda": "🐼",
    "rooster": "🐓",
    "turkey": "🦃",
    "worm": "🪱",
    # "bat" excluded — ambiguous (animal vs baseball bat)

    # ── Food & Drink ──
    "apple": "🍎",
    "banana": "🍌",
    "grape": "🍇",
    "orange": "🍊",
    "watermelon": "🍉",
    "strawberry": "🍓",
    "pineapple": "🍍",
    "corn": "🌽",
    "carrot": "🥕",
    "potato": "🥔",
    "onion": "🧅",
    "garlic": "🧄",
    "mushroom": "🍄",
    "bread": "🍞",
    "egg": "🥚",
    "rice": "🍚",
    "pizza": "🍕",
    "sandwich": "🥪",
    "noodle": "🍜",
    "soup": "🍲",
    "meat": "🥩",
    "bacon": "🥓",
    "cake": "🎂",
    "cookie": "🍪",
    "candy": "🍬",
    "chocolate": "🍫",
    "pie": "🥧",
    "popcorn": "🍿",
    "salt": "🧂",
    "honey": "🍯",
    "milk": "🥛",
    "tea": "🍵",
    "juice": "🧃",
    "bean": "🫘",
    "blueberry": "🫐",
    "cucumber": "🥒",
    "olive": "🫒",
    "pancake": "🥞",
    "pepper": "🌶️",

    # ── Nature & Weather ──
    "sun": "☀️",
    "moon": "🌙",
    "star": "⭐",
    "cloud": "☁️",
    "rain": "🌧️",
    "snow": "❄️",
    "wind": "🌬️",
    "rainbow": "🌈",
    "fire": "🔥",
    "water": "💧",
    "tree": "🌳",
    "flower": "🌸",
    "rose": "🌹",
    "sunflower": "🌻",
    "tulip": "🌷",
    "leaf": "🍃",
    "mountain": "⛰️",
    "volcano": "🌋",
    "ocean": "🌊",
    "island": "🏝️",
    "desert": "🏜️",
    "lightning": "⚡",
    "tornado": "🌪️",
    "sunset": "🌅",
    "earth": "🌍",
    "globe": "🌐",
    "comet": "☄️",
    "cactus": "🌵",
    "bamboo": "🎋",
    "forest": "🌲",
    "river": "🏞️",

    # ── Objects ──
    "book": "📖",
    "pen": "🖊️",
    "pencil": "✏️",
    "phone": "📱",
    "computer": "💻",
    "keyboard": "⌨️",
    "clock": "🕐",
    "watch": "⌚",
    "key": "🔑",
    "lock": "🔒",
    "door": "🚪",
    "window": "🪟",
    "lamp": "💡",
    "candle": "🕯️",
    "mirror": "🪞",
    "chair": "🪑",
    "bed": "🛏️",
    "umbrella": "☂️",
    "glasses": "👓",
    "bag": "👜",
    "scissors": "✂️",
    "hammer": "🔨",
    "knife": "🔪",
    "shield": "🛡️",
    "sword": "🗡️",
    # "bow" excluded — DB meaning is "인사하다" not bow & arrow
    "bell": "🔔",
    "balloon": "🎈",
    "gift": "🎁",
    "camera": "📷",
    "television": "📺",
    "radio": "📻",
    "guitar": "🎸",
    "piano": "🎹",
    "drum": "🥁",
    "trumpet": "🎺",
    "magnet": "🧲",
    "telescope": "🔭",
    "microscope": "🔬",
    "battery": "🔋",
    "plug": "🔌",
    "envelope": "✉️",
    "newspaper": "📰",
    "calendar": "📅",
    "map": "🗺️",
    "compass": "🧭",
    "backpack": "🎒",
    "basket": "🧺",
    "thread": "🧵",
    "needle": "🪡",
    "brush": "🖌️",
    "broom": "🧹",
    "soap": "🧼",
    "sponge": "🧽",
    "bucket": "🪣",
    "ladder": "🪜",
    "chain": "⛓️",
    "bomb": "💣",
    "flag": "🏁",
    "medal": "🏅",
    "crown": "👑",
    "ring": "💍",
    "anchor": "⚓",
    "bandage": "🩹",
    "coin": "🪙",
    "feather": "🪶",
    "pill": "💊",
    "rope": "🪢",
    "satellite": "📡",
    "thermometer": "🌡️",
    "nest": "🪹",

    # ── Vehicles & Transport ──
    "car": "🚗",
    "bus": "🚌",
    "ambulance": "🚑",
    "taxi": "🚕",
    "bicycle": "🚲",
    "airplane": "✈️",
    "helicopter": "🚁",
    "rocket": "🚀",
    "ship": "🚢",
    "boat": "⛵",
    "train": "🚂",
    "tractor": "🚜",
    "skateboard": "🛹",
    "parachute": "🪂",

    # ── Body & People ──
    "eye": "👁️",
    "ear": "👂",
    "nose": "👃",
    "mouth": "👄",
    "tongue": "👅",
    "hand": "✋",
    "foot": "🦶",
    "bone": "🦴",
    "brain": "🧠",
    "heart": "❤️",
    "tooth": "🦷",
    "muscle": "💪",
    "baby": "👶",
    "boy": "👦",
    "girl": "👧",
    "king": "🤴",
    "queen": "👸",
    "angel": "😇",
    "ghost": "👻",
    "robot": "🤖",
    "clown": "🤡",
    "mermaid": "🧜",
    "wizard": "🧙",
    "pirate": "🏴‍☠️",
    "doctor": "👨‍⚕️",
    "teacher": "👨‍🏫",
    "student": "👨‍🎓",
    "farmer": "👨‍🌾",
    "police": "👮",
    "soldier": "🪖",
    "astronaut": "👨‍🚀",
    "pilot": "👨‍✈️",
    "artist": "👨‍🎨",
    "scientist": "👨‍🔬",
    "judge": "👨‍⚖️",

    # ── Emotions & States ──
    "happy": "😊",
    "sad": "😢",
    "angry": "😠",
    "scared": "😨",
    "surprised": "😮",
    "sick": "🤒",
    "sleepy": "😴",
    "tired": "😩",
    "hungry": "🤤",
    "cold": "🥶",
    "hot": "🥵",
    "love": "😍",
    "cry": "😭",
    "laugh": "😂",
    "think": "🤔",
    "cool": "😎",
    "shy": "😳",
    "crazy": "🤪",
    "dizzy": "😵",
    "nervous": "😰",

    # ── Actions ──
    "run": "🏃",
    "swim": "🏊",
    "dance": "💃",
    "sing": "🎙️",
    "cook": "👨‍🍳",
    "write": "✍️",
    "pray": "🙏",
    "wave": "🌊",
    "clap": "👏",
    "hug": "🤗",
    "fight": "⚔️",
    # "fly" excluded — 🕊️ is dove, not generic "fly"
    "climb": "🧗",
    "surf": "🏄",
    "ski": "⛷️",
    "camp": "🏕️",
    # "fish" excluded — duplicate with animal fish🐟
    "dive": "🤿",

    # ── Places & Buildings ──
    "house": "🏠",
    "school": "🏫",
    "hospital": "🏥",
    "church": "⛪",
    "castle": "🏰",
    "tent": "⛺",
    "factory": "🏭",
    "store": "🏪",
    "bank": "🏦",
    "hotel": "🏨",
    "library": "📚",
    "museum": "🏛️",
    "stadium": "🏟️",
    "bridge": "🌉",
    "fountain": "⛲",
    "tower": "🗼",
    "palace": "🏯",
    "temple": "🛕",
    # "statue" excluded — 🗽 is Statue of Liberty, too specific for generic "조각상"
    # "lighthouse" excluded — no dedicated emoji

    # ── Clothing & Accessories ──
    "shirt": "👕",
    "dress": "👗",
    "pants": "👖",
    "hat": "🎩",
    "shoe": "👟",
    "scarf": "🧣",
    "glove": "🧤",
    "tie": "👔",
    "coat": "🧥",
    # "belt" excluded — 🪢 is knot emoji, no belt emoji exists

    # ── Sports & Games ──
    "soccer": "⚽",
    "basketball": "🏀",
    "baseball": "⚾",
    "tennis": "🎾",
    "volleyball": "🏐",
    "football": "🏈",
    "golf": "⛳",
    "bowling": "🎳",
    "chess": "♟️",
    "dice": "🎲",
    "puzzle": "🧩",
    "target": "🎯",
    "kite": "🪁",
    "badminton": "🏸",
    "rugby": "🏉",

    # ── Music & Art ──
    "music": "🎵",
    "movie": "🎬",
    "art": "🎨",
    "theater": "🎭",
    "ticket": "🎫",
    "fireworks": "🎆",
    "party": "🎉",
    "magic": "🪄",

    # ── Symbols & Misc ──
    "money": "💰",
    "mail": "📧",
    "peace": "☮️",
    "recycle": "♻️",
    "skull": "💀",
    # "rainbow" excluded — duplicate with Nature section
    "sparkle": "✨",
    "hundred": "💯",
}

# ─── Polysemy Blacklist ──────────────────────────────────────────────────────
# For words with multiple meanings, block emoji when Korean meaning indicates
# the non-visual/abstract meaning that doesn't match the emoji.
# Format: english_lower → list of Korean substrings that should BLOCK emoji.
_POLYSEMY_BLOCK: dict[str, list[str]] = {
    "bear": ["참다", "견디다", "낳다"],              # 🐻 only for 곰
    "bank": ["둑", "제방", "거래하다"],              # 🏦 only for 은행
    "run": ["운영", "경영", "작동"],                 # 🏃 only for 달리다
    "store": ["저장", "비축"],                       # 🏪 only for 가게
    "key": ["중요한", "핵심", "해답", "실마리"],      # 🔑 only for 열쇠
    "party": ["정당", "당사자"],                     # 🎉 only for 파티
    "ship": ["보내다"],                              # 🚢 only for 배
    "plug": ["메우다", "틀어막다"],                   # 🔌 only for 플러그
    "dice": ["썰다"],                                # 🎲 only for 주사위
    "anchor": ["사회", "앵커"],                      # ⚓ only for 닻
    "bomb": ["폭격하다"],                            # 💣 only for 폭탄
    "lock": ["잠그다"],                              # 🔒 only for 자물쇠
    "shield": ["보호하다", "가리다"],                 # 🛡️ only for 방패
    "target": ["겨냥하다", "대상으로"],               # 🎯 only for 과녁/목표(noun)
    "judge": ["판단하다", "평가하다"],                # 👨‍⚖️ only for 판사
    "wave": ["손을 흔들"],                           # 🌊 only for 물결/파도
    "cool": ["시원한"],                              # 😎 only for 멋진
    "book": ["예약"],                                # 📖 only for 책
}

# Build reverse map for quick lookup
_REVERSE_MAP: dict[str, str] = {v: k for k, v in EMOJI_MAP.items()}

# Pre-compute lowercase keys set for fast membership check
_EMOJI_KEYS: set[str] = set(EMOJI_MAP.keys())


def get_emoji(english: str, korean: str | None = None) -> str | None:
    """Return the emoji for an English word, or None if not mapped.

    If korean is provided, checks polysemy blacklist to avoid mismatched emoji
    for multi-meaning words (e.g. bear=참다 should not get 🐻).
    """
    key = english.strip().lower()
    emoji = EMOJI_MAP.get(key)
    if emoji and korean and key in _POLYSEMY_BLOCK:
        for blocked_substr in _POLYSEMY_BLOCK[key]:
            if blocked_substr in korean:
                return None
    return emoji


def has_emoji(english: str, korean: str | None = None) -> bool:
    """Check if an English word has an emoji mapping.

    If korean is provided, also checks polysemy blacklist.
    """
    return get_emoji(english, korean) is not None


def get_emoji_distractors(
    correct_english: str,
    all_english: list[str],
    count: int = 3,
) -> list[str]:
    """Pick distractor English words that also have emoji mappings.

    Prefers words with emojis so the question feels thematically consistent.
    Falls back to non-emoji words if needed.
    """
    correct_lower = correct_english.strip().lower()

    # First: words with emoji mappings (excluding correct)
    emoji_pool = [
        e for e in all_english
        if e.strip().lower() != correct_lower and has_emoji(e)
    ]

    if len(emoji_pool) >= count:
        return random.sample(emoji_pool, count)

    # Not enough emoji words: fill from non-emoji pool
    non_emoji_pool = [
        e for e in all_english
        if e.strip().lower() != correct_lower and not has_emoji(e)
    ]
    combined = emoji_pool + non_emoji_pool
    return random.sample(combined, min(count, len(combined)))


def emoji_coverage_stats(words: list[str]) -> dict:
    """Return stats on how many words in the given list have emoji mappings.

    Useful for diagnostics / admin dashboard.
    """
    mapped = [w for w in words if has_emoji(w)]
    return {
        "total": len(words),
        "mapped": len(mapped),
        "coverage_pct": round(len(mapped) / len(words) * 100, 1) if words else 0,
    }
