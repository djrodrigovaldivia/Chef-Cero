export interface KitchenEmergency {
  id: string;
  title: string;
  badge: string;
  severity: 'critical' | 'high' | 'medium';
  immediateAction: string;
  goldenRule: string;
  steps: string[];
}

export const KITCHEN_EMERGENCIES: KitchenEmergency[] = [
  {
    id: 'humo-aceite',
    title: '¡Mucho humo blanco o aceite quemándose!',
    badge: 'Peligro de fuego',
    severity: 'critical',
    immediateAction: 'Apaga el fuego de inmediato y retira la sartén del fogón caliente.',
    goldenRule: '¡JAMÁS eches agua al aceite caliente! El agua se vaporiza de golpe y crea una llamarada explosiva.',
    steps: [
      'Apaga la hornalla o vitrocerámica en el acto.',
      'Cubre la sartén con una tapa metálica o una bandeja para ahogar el oxígeno.',
      'Con un trapo seco (nunca húmedo), aparta la sartén hacia una zona fría de la encimera.',
      'Enciende el extractor de humos al máximo y abre una ventana.',
    ],
  },
  {
    id: 'pegado-fondo',
    title: '¡La salsa, arroz o guiso se pegó al fondo!',
    badge: 'Rescate de sabor',
    severity: 'high',
    immediateAction: '¡NO raspes el fondo con la cuchara! Si raspas, mezclarás el carbón amargo con el resto.',
    goldenRule: 'Lo que no toca el fondo quemado aún tiene salvación y sabor perfecto.',
    steps: [
      'Apaga el fuego de inmediato para frenar el quemado.',
      'Vierte con cuidado la parte superior de la comida en otra cacerola limpia, sin tocar el fondo.',
      'Deja la cacerola quemada con agua caliente y bicarbonato o vinagre para limpiarla después.',
      'Prueba la comida trasvasada: si notas un ligero regusto ahumado, añade una cucharadita de miel o una pizca de azúcar para neutralizarlo.',
    ],
  },
  {
    id: 'exceso-sal',
    title: '¡Se me fue la mano con la sal!',
    badge: 'Corrección de condimento',
    severity: 'medium',
    immediateAction: 'No entres en pánico: el sodio tiene solución física y gustativa.',
    goldenRule: 'La sal no se puede evaporar, pero sí se puede absorber o equilibrar con volumen o ácido.',
    steps: [
      'Si es sopa o guiso: Pela una patata cruda, córtala en rodajas gruesas y déjala hervir 10 minutos. Absorberá el exceso de sodio como una esponja; luego retírala.',
      'Si es salsa: Diluye añadiendo un chorrito de agua caliente, caldo sin sal, leche, nata o yogur griego.',
      'Si es salteado: Añade unas gotas de jugo de limón fresco o una pizca de vinagre suave; la acidez engaña al paladar y equilibra el exceso salino.',
    ],
  },
  {
    id: 'desborde-espuma',
    title: '¡El agua de la pasta o la leche se desborda!',
    badge: 'Físico / Control térmico',
    severity: 'medium',
    immediateAction: 'Pon una cuchara de madera atravesada sobre la boca de la olla.',
    goldenRule: 'La madera rompe la tensión superficial de las burbujas de almidón y frena el desborde al instante.',
    steps: [
      'Apoya una cuchara o espátula de madera de borde a borde encima de la cazuela.',
      'Baja el fuego a potencia media-baja (fuego tembloroso).',
      'Retira la tapa por completo para que el vapor escape con libertad.',
      'Si es leche, retira la olla del fogón durante 5 segundos para que la espuma baje.',
    ],
  },
  {
    id: 'mayonesa-cortada',
    title: '¡Se me cortó la salsa, mayonesa o alioli!',
    badge: 'Emulsión',
    severity: 'medium',
    immediateAction: 'No la tires. Las grasas y los líquidos solo se han desunido y pueden volver a unirse.',
    goldenRule: 'La física de la emulsión se repara comenzando una base limpia.',
    steps: [
      'En un bol limpio aparte, pon 1 cucharada de agua tibia (o una nueva yema de huevo).',
      'Bate con varilla o batidora a velocidad constante.',
      'Comienza a verter la mezcla cortada muy despacio, hilo a hilo, sin dejar de batir.',
      'En menos de 30 segundos volverá a quedar sedosa, brillante y consistente.',
    ],
  },
  {
    id: 'dorado-fuera-crudo-dentro',
    title: '¡Carne o pollo dorado por fuera pero crudo dentro!',
    badge: 'Cocción térmica',
    severity: 'high',
    immediateAction: 'Baja el fuego al mínimo y tapa la sartén.',
    goldenRule: 'Subir el fuego solo carbonizará el exterior sin cocinar el corazón.',
    steps: [
      'Baja el fuego a nivel suave (fuego 2 o 3 en vitrocerámica).',
      'Tapa la sartén: esto creará un efecto horno reteniendo el calor residual para cocinar el interior.',
      'Si la pieza es muy gruesa (pechuga entera o filete grueso): Métela al horno precalentado a 180°C durante 6 a 8 minutos.',
      'Antes de cortar, deja reposar la carne 3 minutos en un plato para que los jugos se redistribuyan.',
    ],
  },
];
