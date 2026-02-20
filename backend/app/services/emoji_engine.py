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
    "goat": "🐐",
    "camel": "🐪",
    "gorilla": "🦍",
    "zebra": "🦓",
    "giraffe": "🦒",
    "crocodile": "🐊",
    "octopus": "🐙",
    "snail": "🐌",
    "ant": "🐜",
    "spider": "🕷️",
    "parrot": "🦜",
    "flamingo": "🦩",
    "peacock": "🦚",
    "swan": "🦢",
    "eagle": "🦅",
    # "bat" excluded — ambiguous (animal vs baseball bat)

    # ── Food & Drink ──
    "apple": "🍎",
    "banana": "🍌",
    "grape": "🍇",
    "orange": "🍊",
    "lemon": "🍋",
    "watermelon": "🍉",
    "strawberry": "🍓",
    "peach": "🍑",
    "cherry": "🍒",
    "pineapple": "🍍",
    "coconut": "🥥",
    "avocado": "🥑",
    "broccoli": "🥦",
    "corn": "🌽",
    "carrot": "🥕",
    "tomato": "🍅",
    "potato": "🥔",
    "onion": "🧅",
    "garlic": "🧄",
    "mushroom": "🍄",
    "peanut": "🥜",
    "bread": "🍞",
    "cheese": "🧀",
    "egg": "🥚",
    "rice": "🍚",
    "pizza": "🍕",
    "hamburger": "🍔",
    "hotdog": "🌭",
    "sandwich": "🥪",
    "taco": "🌮",
    "sushi": "🍣",
    "noodle": "🍜",
    "soup": "🍲",
    "meat": "🥩",
    "bacon": "🥓",
    "shrimp": "🦐",
    "cake": "🎂",
    "cookie": "🍪",
    "candy": "🍬",
    "chocolate": "🍫",
    "donut": "🍩",
    "pie": "🥧",
    "popcorn": "🍿",
    "salt": "🧂",
    "honey": "🍯",
    "milk": "🥛",
    "coffee": "☕",
    "tea": "🍵",
    "wine": "🍷",
    "beer": "🍺",
    "juice": "🧃",
    "ice cream": "🍦",

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
    "axe": "🪓",
    "knife": "🔪",
    "shield": "🛡️",
    "sword": "🗡️",
    "bow": "🏹",
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
    "violin": "🎻",
    "microphone": "🎤",
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
    "trophy": "🏆",
    "medal": "🏅",
    "crown": "👑",
    "diamond": "💎",
    "ring": "💍",

    # ── Vehicles & Transport ──
    "car": "🚗",
    "bus": "🚌",
    "truck": "🚛",
    "ambulance": "🚑",
    "taxi": "🚕",
    "bicycle": "🚲",
    "motorcycle": "🏍️",
    "airplane": "✈️",
    "helicopter": "🚁",
    "rocket": "🚀",
    "ship": "🚢",
    "boat": "⛵",
    "train": "🚂",
    "tractor": "🚜",
    "canoe": "🛶",
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
    "ninja": "🥷",
    "fairy": "🧚",
    "mermaid": "🧜",
    "wizard": "🧙",
    "pirate": "🏴‍☠️",

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
    "wave": "👋",
    "clap": "👏",
    "hug": "🤗",
    "fight": "⚔️",
    "fly": "🕊️",
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
    # "lighthouse" excluded — no dedicated emoji

    # ── Clothing & Accessories ──
    "shirt": "👕",
    "dress": "👗",
    "pants": "👖",
    "hat": "🎩",
    "shoe": "👟",
    "boot": "🥾",
    "scarf": "🧣",
    "glove": "🧤",
    "sock": "🧦",
    "tie": "👔",
    "bikini": "👙",
    "coat": "🧥",
    "belt": "🪢",

    # ── Sports & Games ──
    "soccer": "⚽",
    "basketball": "🏀",
    "baseball": "⚾",
    "tennis": "🎾",
    "volleyball": "🏐",
    "football": "🏈",
    "golf": "⛳",
    "bowling": "🎳",
    "boxing": "🥊",
    "wrestling": "🤼",
    "chess": "♟️",
    "dice": "🎲",
    "puzzle": "🧩",
    "target": "🎯",
    "kite": "🪁",

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
    "poop": "💩",
    # "rainbow" excluded — duplicate with Nature section
    "sparkle": "✨",
    "hundred": "💯",
}

# Build reverse map for quick lookup
_REVERSE_MAP: dict[str, str] = {v: k for k, v in EMOJI_MAP.items()}

# Pre-compute lowercase keys set for fast membership check
_EMOJI_KEYS: set[str] = set(EMOJI_MAP.keys())


def get_emoji(english: str) -> str | None:
    """Return the emoji for an English word, or None if not mapped."""
    return EMOJI_MAP.get(english.strip().lower())


def has_emoji(english: str) -> bool:
    """Check if an English word has an emoji mapping."""
    return english.strip().lower() in _EMOJI_KEYS


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
