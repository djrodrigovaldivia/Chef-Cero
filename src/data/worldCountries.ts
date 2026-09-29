export interface WorldCountry {
  id: string;
  name: string;
  flag: string;
  continent: 'América del Sur' | 'Centro & Norteamérica' | 'Europa' | 'Asia' | 'Medio Oriente & África' | 'Oceanía';
  signatureDishes: string;
  isPopular?: boolean;
}

export const WORLD_COUNTRIES: WorldCountry[] = [
  // --- AMÉRICA DEL SUR ---
  { id: 'cl', name: 'Chile', flag: '🇨🇱', continent: 'América del Sur', signatureDishes: 'Tomaticán, Charquicán, Pebre con marraqueta', isPopular: true },
  { id: 'pe', name: 'Perú', flag: '🇵🇪', continent: 'América del Sur', signatureDishes: 'Lomo Saltado, Ají de Gallina, Arroz Chaufa', isPopular: true },
  { id: 'ar', name: 'Argentina', flag: '🇦🇷', continent: 'América del Sur', signatureDishes: 'Milanesa a la Napolitana, Chimichurri, Matambre', isPopular: true },
  { id: 'co', name: 'Colombia', flag: '🇨🇴', continent: 'América del Sur', signatureDishes: 'Arepas de queso, Arroz con pollo campesino, Ajiaco', isPopular: true },
  { id: 'br', name: 'Brasil', flag: '🇧🇷', continent: 'América del Sur', signatureDishes: 'Pão de Queijo, Feijoada rápida, Moqueca', isPopular: true },
  { id: 'uy', name: 'Uruguay', flag: '🇺🇾', continent: 'América del Sur', signatureDishes: 'Chivito al plato, Pascualina criolla', isPopular: false },
  { id: 'ec', name: 'Ecuador', flag: '🇪🇨', continent: 'América del Sur', signatureDishes: 'Seco de pollo, Llapingachos dorados', isPopular: false },
  { id: 'bo', name: 'Bolivia', flag: '🇧🇴', continent: 'América del Sur', signatureDishes: 'Silpancho crujiente, Pique Macho express', isPopular: false },
  { id: 've', name: 'Venezuela', flag: '🇻🇪', continent: 'América del Sur', signatureDishes: 'Arepa Reina Pepiada, Pabellón criollo express', isPopular: false },
  { id: 'py', name: 'Paraguay', flag: '🇵🇾', continent: 'América del Sur', signatureDishes: 'Sopa paraguaya dorada, Chipa casera', isPopular: false },

  // --- CENTRO & NORTEAMÉRICA ---
  { id: 'mx', name: 'México', flag: '🇲🇽', continent: 'Centro & Norteamérica', signatureDishes: 'Chilaquiles rojos, Quesadillas doraditas, Tacos de sartén', isPopular: true },
  { id: 'us', name: 'Estados Unidos', flag: '🇺🇸', continent: 'Centro & Norteamérica', signatureDishes: 'Smash Burger, Mac & Cheese cremoso, Pancakes', isPopular: true },
  { id: 'ca', name: 'Canadá', flag: '🇨🇦', continent: 'Centro & Norteamérica', signatureDishes: 'Poutine casero con salsa gravy, Tarta de arce', isPopular: false },
  { id: 'cu', name: 'Cuba', flag: '🇨🇺', continent: 'Centro & Norteamérica', signatureDishes: 'Ropa Vieja tierna, Moros y Cristianos', isPopular: false },
  { id: 'do', name: 'Rep. Dominicana', flag: '🇩🇴', continent: 'Centro & Norteamérica', signatureDishes: 'Mangú suave con cebolla morada, Pollo guisado', isPopular: false },
  { id: 'cr', name: 'Costa Rica', flag: '🇨🇷', continent: 'Centro & Norteamérica', signatureDishes: 'Gallo Pinto tradicional, Casado campesino', isPopular: false },
  { id: 'gt', name: 'Guatemala', flag: '🇬🇹', continent: 'Centro & Norteamérica', signatureDishes: 'Pepián aromático, Dobladas de queso', isPopular: false },
  { id: 'sv', name: 'El Salvador', flag: '🇸🇻', continent: 'Centro & Norteamérica', signatureDishes: 'Pupusas de queso con curtido', isPopular: false },
  { id: 'pa', name: 'Panamá', flag: '🇵🇦', continent: 'Centro & Norteamérica', signatureDishes: 'Sancocho panameño con ñame, Arroz con guandú', isPopular: false },

  // --- EUROPA ---
  { id: 'it', name: 'Italia', flag: '🇮🇹', continent: 'Europa', signatureDishes: 'Pasta Pomodoro 15 min, Carbonara romana, Risotto', isPopular: true },
  { id: 'es', name: 'España', flag: '🇪🇸', continent: 'Europa', signatureDishes: 'Tortilla de Patatas jugosa, Paella express, Gambas al ajillo', isPopular: true },
  { id: 'fr', name: 'Francia', flag: '🇫🇷', continent: 'Europa', signatureDishes: 'Omelette Babette sedoso, Ratatouille, Quiche Lorraine', isPopular: true },
  { id: 'gr', name: 'Grecia', flag: '🇬🇷', continent: 'Europa', signatureDishes: 'Moussaka de sartén, Tzatziki con pan pita, Souvlaki', isPopular: true },
  { id: 'de', name: 'Alemania', flag: '🇩🇪', continent: 'Europa', signatureDishes: 'Schnitzel crujiente con limón, Kartoffelsalat', isPopular: true },
  { id: 'gb', name: 'Reino Unido', flag: '🇬🇧', continent: 'Europa', signatureDishes: 'Shepherd\'s Pie casero, Fish & Chips al sartén', isPopular: false },
  { id: 'pt', name: 'Portugal', flag: '🇵🇹', continent: 'Europa', signatureDishes: 'Bacalhau à Brás, Caldo Verde reconfortante', isPopular: false },
  { id: 'nl', name: 'Países Bajos', flag: '🇳🇱', continent: 'Europa', signatureDishes: 'Stamppot de patatas y verduras, Poffertjes', isPopular: false },
  { id: 'be', name: 'Bélgica', flag: '🇧🇪', continent: 'Europa', signatureDishes: 'Mejillones con vino blanco y papas fritas', isPopular: false },
  { id: 'ch', name: 'Suiza', flag: '🇨🇭', continent: 'Europa', signatureDishes: 'Rösti de patata dorada, Fondue suave', isPopular: false },
  { id: 'at', name: 'Austria', flag: '🇦🇹', continent: 'Europa', signatureDishes: 'Wiener Schnitzel dorado, Apfelstrudel express', isPopular: false },
  { id: 'se', name: 'Suecia', flag: '🇸🇪', continent: 'Europa', signatureDishes: 'Albóndigas Köttbullar con salsa suave y puré', isPopular: false },
  { id: 'no', name: 'Noruega', flag: '🇳🇴', continent: 'Europa', signatureDishes: 'Salmón pochado con eneldo y patatas', isPopular: false },
  { id: 'ie', name: 'Irlanda', flag: '🇮🇪', continent: 'Europa', signatureDishes: 'Irish Stew estofado de carne y papas', isPopular: false },
  { id: 'pl', name: 'Polonia', flag: '🇵🇱', continent: 'Europa', signatureDishes: 'Pierogi caseros de papa y queso, Bigos', isPopular: false },
  { id: 'cz', name: 'Rep. Checa', flag: '🇨🇿', continent: 'Europa', signatureDishes: 'Goulash bohemio con dumplings de pan', isPopular: false },
  { id: 'hu', name: 'Hungría', flag: '🇭🇺', continent: 'Europa', signatureDishes: 'Goulash húngaro especiado con pimentón', isPopular: false },

  // --- ASIA ---
  { id: 'th', name: 'Tailandia', flag: '🇹🇭', continent: 'Asia', signatureDishes: 'Pad Thai agridulce, Curry amarillo con coco, Tom Kha', isPopular: true },
  { id: 'jp', name: 'Japón', flag: '🇯🇵', continent: 'Asia', signatureDishes: 'Oyakodon cremoso, Teriyaki de pollo, Yakisoba', isPopular: true },
  { id: 'cn', name: 'China', flag: '🇨🇳', continent: 'Asia', signatureDishes: 'Arroz Chaufa Cantonés, Salteado agridulce, Mapo tofu suave', isPopular: true },
  { id: 'in', name: 'India', flag: '🇮🇳', continent: 'Asia', signatureDishes: 'Butter Chicken suave, Dal de lentejas aromático, Curry Tikka', isPopular: true },
  { id: 'kr', name: 'Corea del Sur', flag: '🇰🇷', continent: 'Asia', signatureDishes: 'Bibimbap de sartén, Bulgogi tierno, Kimchi bokkeumbap', isPopular: true },
  { id: 'vn', name: 'Vietnam', flag: '🇻🇳', continent: 'Asia', signatureDishes: 'Pho Ga caldo aromático de pollo, Rollos frescos', isPopular: false },
  { id: 'id', name: 'Indonesia', flag: '🇮🇩', continent: 'Asia', signatureDishes: 'Nasi Goreng con huevo frito, Pollo Satay', isPopular: false },
  { id: 'ph', name: 'Filipinas', flag: '🇵🇭', continent: 'Asia', signatureDishes: 'Chicken Adobo con soya y vinagre, Pancit canton', isPopular: false },
  { id: 'my', name: 'Malasia', flag: '🇲🇾', continent: 'Asia', signatureDishes: 'Rendang tierno de carne, Laksa suave', isPopular: false },
  { id: 'tw', name: 'Taiwán', flag: '🇹🇼', continent: 'Asia', signatureDishes: 'Lu Rou Fan arroz con carne glaseada, Fideos de res', isPopular: false },

  // --- MEDIO ORIENTE & ÁFRICA ---
  { id: 'tr', name: 'Turquía', flag: '🇹🇷', continent: 'Medio Oriente & África', signatureDishes: 'Menemen huevos revueltos con tomate, Köfte especiado', isPopular: true },
  { id: 'ma', name: 'Marruecos', flag: '🇲🇦', continent: 'Medio Oriente & África', signatureDishes: 'Cuscús aromático con verduras, Tajine de pollo y limón', isPopular: true },
  { id: 'lb', name: 'Líbano', flag: '🇱🇧', continent: 'Medio Oriente & África', signatureDishes: 'Hummus sedoso casero, Tabbouleh fresco, Shish Taouk', isPopular: true },
  { id: 'eg', name: 'Egipto', flag: '🇪🇬', continent: 'Medio Oriente & África', signatureDishes: 'Koshari de arroz, lentejas y pasta, Ful Medames', isPopular: false },
  { id: 'il', name: 'Israel', flag: '🇮🇱', continent: 'Medio Oriente & África', signatureDishes: 'Shakshuka en sartén con huevos escalfados, Falafel dorado', isPopular: false },
  { id: 'za', name: 'Sudáfrica', flag: '🇿🇦', continent: 'Medio Oriente & África', signatureDishes: 'Bobotie horneado especiado, Chakalaka vegetal', isPopular: false },

  // --- OCEANÍA ---
  { id: 'au', name: 'Australia', flag: '🇦🇺', continent: 'Oceanía', signatureDishes: 'Meat Pie pastel de carne tradicional, Tostada de aguacate con huevo pochado', isPopular: false },
  { id: 'nz', name: 'Nueva Zelanda', flag: '🇳🇿', continent: 'Oceanía', signatureDishes: 'Cordero asado al romero con batatas doradas', isPopular: false },
];

export const CONTINENTS = [
  'Todos',
  'América del Sur',
  'Centro & Norteamérica',
  'Europa',
  'Asia',
  'Medio Oriente & África',
  'Oceanía',
] as const;
