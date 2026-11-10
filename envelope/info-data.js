// envelope/info-data.js
// Plain-language information cards for Envelope Lab. Pure data, no DOM.
// Every entry answers: what is it, why does it matter, what goes wrong, what to do.
// Sources: BCI = Ching, Building Construction Illustrated, 6th ed. (the owner's study notes).
// "ARE notes" = the owner's ARE study notes (Building envelope, Thermal envelope).
// sourceKind: 'ching' (from the notes), 'mixed' (notes plus standard practice), 'general' (practice only).
// R-values and perms here must match envelope/materials.js (tests/info-data.test.mjs checks this).

import { MATERIALS } from './materials.js';

const make = (kind) => (id, body) => ({ id, kind, ...body });
const layer = make('layer');
const concept = make('concept');
const part = make('part');

const LAYERS = [
  // ------------------------------------------------------------------ interior finish and sheathing
  layer('gyp_050', {
    title: 'Gypsum board, 1/2 in.',
    short: 'Smooth interior finish that also resists fire.',
    what: 'A factory sheet with a gypsum core and paper faces. It is the usual interior finish on a framed wall.',
    job: 'It gives a flat surface for paint and resists fire. Unpainted, it lets vapor through freely, so it is not a vapor retarder. With taped joints it can also serve as the air barrier.',
    control: 'finish',
    ifWrong: 'Wet board softens and grows mold on its paper face. Open joints and gaps let indoor air leak into the wall.',
    doThis: 'Seal joints and edges where the board is the air barrier. Use water-resistant board near wet areas. Choose the paint or retarder class that fits the climate zone.',
    products: ['Regular tapered-edge wallboard', 'Type X fire-rated board', 'Water-resistant board', 'Foil-backed board'],
    facts: [
      { label: 'R-value', value: '0.45' },
      { label: 'Thickness', value: '1/2 in.' },
      { label: 'Permeance (perms)', value: '50 (approximate)' },
    ],
    mistake: 'Counting unpainted drywall as a vapor retarder. At about 50 perms it hardly slows vapor at all.',
    are: 'PDD: Know the board types. Type X is for fire rating, water-resistant board is the tile base in wet areas, and foil-backed board can act as a vapor retarder.',
    more: [
      'Tapered edges let the crew tape and fill the joints so the seams disappear. The same taped joints are what make an airtight drywall approach possible.',
      'Foil-backed board also reflects heat, but only when the foil faces an air space at least 3/4 in. deep.',
    ],
    related: ['gyp_063', 'vapor_retarder', 'air_barrier', 'vapor_classes'],
    source: 'BCI 10.09, 7.40, 7.48, building science practice',
    sourceKind: 'mixed',
  }),

  layer('gyp_063', {
    title: 'Gypsum board, 5/8 in.',
    short: 'Thicker interior board, common in fire-rated walls.',
    what: 'The same kind of gypsum board as the 1/2 in. sheet, but thicker. Both thicknesses are used for single-layer walls.',
    job: 'The extra thickness adds a little R-value and more fire and sound resistance. Type X fire-rated board comes in both thicknesses, and 5/8 in. is common in rated walls.',
    control: 'finish',
    ifWrong: 'Wet board softens and grows mold. Unsealed joints let indoor air into the wall cavity, and that air carries water vapor with it.',
    doThis: 'Seal the joints if the board is the air barrier. Keep it dry during construction. Confirm the fire rating of the whole assembly, not just the board.',
    products: ['Type X fire-rated board', 'Regular tapered-edge wallboard', 'Moisture-resistant board'],
    facts: [
      { label: 'R-value', value: '0.56' },
      { label: 'Thickness', value: '5/8 in.' },
      { label: 'Permeance (perms)', value: '40 (approximate)' },
    ],
    mistake: 'Assuming a thicker board changes the vapor class. At about 40 perms it is still very open to vapor.',
    are: 'PDD: Know that a fire rating belongs to a tested assembly. The board type and thickness are only part of it.',
    more: [
      'Heavier board also helps sound control. For tile in wet areas use water-resistant board, not regular board.',
    ],
    related: ['gyp_050', 'air_barrier', 'vapor_retarder', 'steel_stud'],
    source: 'BCI 10.09, building science practice',
    sourceKind: 'mixed',
  }),

  layer('gyp_sheath', {
    title: 'Exterior gypsum sheathing, 5/8 in.',
    short: 'Fire-resistant panel behind the water barrier.',
    what: 'A gypsum panel made for the outside of a wall. It has a water-repellent face and a fire-resistant core.',
    job: 'It gives a flat, fire-resistant base for the water-resistive barrier (WRB), which is the layer that sheds water behind the cladding. It will not hold a nail, so siding must be fastened into the studs.',
    control: 'structure',
    ifWrong: 'Long wetting softens the core. It also sits on the cold side of the cavity, so it is a likely place for condensation in winter.',
    doThis: 'Cover it with a continuous WRB lapped like shingles, and flash every opening. Keep indoor air out of the cavity. Add exterior insulation to keep it warm.',
    products: ['Paper-faced exterior gypsum panel', 'Glass-mat exterior gypsum panel'],
    facts: [
      { label: 'R-value', value: '0.56' },
      { label: 'Thickness', value: '5/8 in.' },
      { label: 'Permeance (perms)', value: '40 (approximate)' },
    ],
    mistake: 'Leaving the panels exposed to rain for weeks before the WRB and cladding go on.',
    are: 'PDD: Know the four sheathing types in a stud wall: rated wood panel, gypsum, fiberboard, and rigid foam. Gypsum holds no nails.',
    more: [
      'At about 40 perms it lets a wall dry to the outside, which helps a steel stud wall. The cavity side still needs an air barrier.',
    ],
    related: ['wrb', 'steel_stud', 'dew_point', 'drying'],
    source: 'BCI 5.46, 10.09, building science practice',
    sourceKind: 'mixed',
  }),

  layer('osb', {
    title: 'OSB sheathing, 7/16 in.',
    short: 'Wood panel that braces the wall.',
    what: 'Oriented strand board (OSB) is a panel pressed from wood strands and resin. It is nailed to the outside of the studs.',
    job: 'It braces the frame against wind and sideways forces and gives a nailable base for siding. At about 2 perms it also slows vapor, so it dries slowly. With sealed joints it can serve as the air barrier.',
    control: 'structure',
    ifWrong: 'OSB swells and rots when it stays wet. In winter it is often the first cold surface inside the wall, so indoor vapor condenses on it.',
    doThis: 'Cover it with a WRB and flash every opening. Keep warm indoor air out with an air barrier. Add insulation outside it so it stays warm and dry.',
    products: ['Rated structural wood panel', 'Plywood panel as an alternative', 'Panel with a built-in water barrier face'],
    facts: [
      { label: 'R-value', value: '0.62' },
      { label: 'Thickness', value: '7/16 in.' },
      { label: 'Permeance (perms)', value: '2 (approximate)' },
    ],
    mistake: 'Butting panels tight. Leave a 1/8 in. joint gap so the panels can swell without buckling.',
    are: 'PDD: Know the panel rules. Siding base is 3/8 in. minimum over studs at 16 in. o.c. and 1/2 in. over studs at 24 in. o.c. Nail 6 in. o.c. at panel edges and 12 in. o.c. at the studs between.',
    more: [
      'OSB is the layer the dew point check in this app usually flags in winter. It is cold, it holds water, and it dries slowly.',
      'Wood, gypsum, and fiberboard panels can brace corners. Foam cannot, so a wall with foam needs other bracing.',
    ],
    related: ['dew_point', 'condensation', 'wrb', 'continuous_insulation', 'drying'],
    source: 'BCI 5.46, building science practice',
    sourceKind: 'mixed',
  }),

  layer('plywood', {
    title: 'Plywood, 1/2 in.',
    short: 'Layered wood panel that braces the wall.',
    what: 'Plywood is thin wood veneers glued in crossed layers. It is nailed to the outside of the studs.',
    job: 'It braces the frame and gives a nailable base for siding. In this app it passes about 1 perm, a little less than OSB, so it slows vapor and dries slowly.',
    control: 'structure',
    ifWrong: 'Plywood delaminates and rots when it stays wet. In winter it is a cold surface inside the wall, so condensation collects on it.',
    doThis: 'Cover it with a WRB and flash every opening. Keep indoor air out with an air barrier. Add exterior insulation to keep it warm and dry.',
    products: ['Rated exterior plywood', 'Plywood with a built-in water barrier face'],
    facts: [
      { label: 'R-value', value: '0.62' },
      { label: 'Thickness', value: '1/2 in.' },
      { label: 'Permeance (perms)', value: '1 (approximate)' },
    ],
    mistake: 'Leaving no joint gap. Like all rated panels it needs about 1/8 in. between sheets.',
    are: 'PDD: Know that softwoods and plywood are about R 1.25 per inch (BCI 7.40) and that rated panels need a 1/8 in. joint gap.',
    more: [
      'Real permeance varies with the panel and with how wet it is. Use the manufacturer data for a real project.',
    ],
    related: ['osb', 'dew_point', 'wrb', 'drying'],
    source: 'BCI 5.46, 7.40, building science practice',
    sourceKind: 'mixed',
  }),

  // ------------------------------------------------------------------ insulation
  layer('batt', {
    title: 'Fiberglass batt',
    short: 'Fluffy insulation mat that fills the stud cavity.',
    what: 'A flexible mat of glass fibers cut to fit between studs. Common labels are R-13, R-19, and R-21.',
    job: 'Tiny pockets of still air in the fibers slow heat flow. The batt fills the cavity but not the studs, so heat still bypasses it through the framing.',
    control: 'thermal',
    ifWrong: 'Gaps, squeezed spots, and voids cut the real R-value sharply. Wet or air-washed batts lose most of their value.',
    doThis: 'Cut the batt to fit snugly with no gaps and no squeezing. Fill the full cavity depth. Seal the air barrier so air cannot move through the fibers.',
    products: ['Unfaced batt', 'Kraft-faced batt (Class II retarder)', 'Foil-faced batt', 'Blanket on a roll'],
    facts: [
      { label: 'R-value (3.5 in.)', value: '13' },
      { label: 'R-value (5.5 in.)', value: '21' },
      { label: 'R-value (6 in.)', value: '19' },
      { label: 'Permeance (perms)', value: '30 (unfaced, approximate)' },
    ],
    mistake: 'Stuffing a thick batt into a shallow cavity. Squeezing removes the air pockets that do the work.',
    are: 'PDD: Know that batts work by trapping still air and that a facing can double as a vapor retarder. Be able to explain why studs lower the whole-wall R-value.',
    more: [
      'Batts do not stop air. Air can flow through and around them, so a batt wall still needs a continuous air barrier.',
      'Batt widths of 16 in. and 24 in. match stud spacing. This app uses the labeled R-value of each batt, which is a little higher per inch than the 3.3 per inch in the BCI table.',
    ],
    related: ['framing_effect', 'air_barrier', 'vapor_retarder', 'r_value', 'wood_stud'],
    source: 'BCI 7.41, 7.46, building science practice',
    sourceKind: 'mixed',
  }),

  layer('minwool', {
    title: 'Mineral wool board',
    short: 'Fire-safe fiber board that lets vapor through.',
    what: 'A firm board spun from rock or slag fibers. It is usually fixed over the sheathing as continuous insulation.',
    job: 'Still air between the fibers slows heat flow, and the board does not burn. At about 15 perms for 2 in. it is open to vapor, so the wall can dry outward through it.',
    control: 'thermal',
    ifWrong: 'Wet fiber loses much of its R-value. The board passes air, so without a separate air barrier behind it, outdoor air can wash through it.',
    doThis: 'Put the WRB and air barrier on the sheathing behind it. Keep the board tight to the sheathing. Leave a drainage gap behind brick.',
    products: ['Semi-rigid mineral wool board', 'Cavity-wall mineral wool board'],
    facts: [
      { label: 'R per inch', value: '4.0' },
      { label: 'R-value (2 in.)', value: '8' },
      { label: 'Permeance (perms)', value: '15 at 2 in. (approximate)' },
    ],
    mistake: 'Expecting the board to be the air or water barrier. It needs a separate barrier behind it.',
    are: 'PDD: Know that continuous insulation outside the framing reduces the thermal bridge of the studs.',
    more: [
      'Because it is vapor open, it does not trap water in the sheathing the way a low-perm foam does. That is a reason to choose it in a wall that must dry outward.',
    ],
    related: ['continuous_insulation', 'thermal_bridge', 'steel_stud', 'drying', 'xps'],
    source: 'BCI 7.41, 7.44, building science practice',
    sourceKind: 'mixed',
  }),

  layer('xps', {
    title: 'XPS board',
    short: 'Closed-cell foam board that resists water and vapor.',
    what: 'Extruded polystyrene (XPS) is a rigid foam board with closed cells. It is fixed to the outside of the wall.',
    job: 'It adds R 5.0 per inch as continuous insulation and shrugs off moisture. At 2 in. it passes only 0.6 perm, so it also blocks the wall from drying outward. Taped joints can make it the air barrier.',
    control: 'thermal',
    ifWrong: 'Under 1 perm it traps any water in the sheathing behind it. Open joints leak air. Sunlight damages exposed faces, and the foam burns.',
    doThis: 'Use only a Class III retarder inside when exterior foam is under 1 perm. Tape or seal the joints. Cover exposed faces against sunlight, and cover foam indoors with a fire-resistant finish.',
    products: ['Extruded polystyrene board', 'Tongue-and-groove foam board'],
    facts: [
      { label: 'R per inch', value: '5.0' },
      { label: 'R-value (2 in.)', value: '10' },
      { label: 'Permeance (perms)', value: '0.6 at 2 in.' },
    ],
    mistake: 'Relying on foam for bracing, or pairing it with a Class I or II retarder inside. Foam adds no racking strength and blocks outward drying.',
    are: 'PDD: Know that exterior foam under 1 perm limits the interior retarder to Class III. Know that foam sheathing cannot brace a wall.',
    more: [
      'Closed-cell foam boards such as XPS can go against soil. Siding must be fastened to the studs, not to the foam alone.',
      'Foam makes the sheathing warmer, which moves the dew point outward. That helps, but the low perm also stops drying outward.',
    ],
    related: ['continuous_insulation', 'vapor_classes', 'drying', 'dew_point', 'eps'],
    source: 'BCI 5.46, 7.41, 7.45, 7.46, 7.48',
    sourceKind: 'ching',
  }),

  layer('eps', {
    title: 'EPS board',
    short: 'Foam board that is more vapor open than XPS.',
    what: 'Expanded polystyrene (EPS) is a rigid foam board made of fused beads. It is fixed to the outside of the wall.',
    job: 'It adds R 3.8 per inch as continuous insulation. Its permeance falls as the board gets thicker, so it is 1.0 perm at 2 in. and lower above that.',
    control: 'thermal',
    ifWrong: 'Thick EPS drops below 1 perm and slows outward drying. Wet foam and open joints lose performance, and the foam burns.',
    doThis: 'Check the perm at the thickness you use. Apply the interior retarder rule when it is under 1 perm. Tape joints if the board is the air barrier.',
    products: ['Molded polystyrene board', 'EPS board for exterior insulation and finish systems'],
    facts: [
      { label: 'R per inch', value: '3.8' },
      { label: 'R-value (2 in.)', value: '7.6' },
      { label: 'Permeance (perms)', value: '1.0 at 2 in.' },
    ],
    mistake: 'Treating EPS and XPS as interchangeable. EPS gives less R per inch and is more open to vapor.',
    are: 'PDD: Know that EPS is used above grade and XPS below grade in an exterior insulation and finish system.',
    more: [
      'The app divides the perm-inch value by the thickness, so a 3 in. board is about 0.67 perm. That crosses the 1 perm line used by the interior retarder rule.',
    ],
    related: ['xps', 'continuous_insulation', 'vapor_classes', 'drying'],
    source: 'BCI 7.38, 7.41, 7.45, building science practice',
    sourceKind: 'mixed',
  }),

  layer('polyiso', {
    title: 'Polyiso board, foil face',
    short: 'High-R foam board with foil faces that stop vapor.',
    what: 'Polyisocyanurate (polyiso) is a rigid foam board with foil facings on both sides.',
    job: 'It gives the most R per inch of the boards here. The foil faces pass only 0.05 perm, so it works as a Class I vapor retarder. Taped joints can make it the air barrier.',
    control: 'thermal',
    ifWrong: 'A wall with polyiso outside cannot dry outward at all. If water gets in or indoor vapor arrives, it stays trapped. The foam also burns.',
    doThis: 'Allow only a Class III retarder indoors. Tape the joints and keep the wall dry during construction. Check the manufacturer for R-value at low temperatures.',
    products: ['Foil-faced polyiso board', 'Polyiso board with coated glass facers'],
    facts: [
      { label: 'R per inch', value: '6.0' },
      { label: 'R-value (2 in.)', value: '12' },
      { label: 'Permeance (perms)', value: '0.05' },
    ],
    mistake: 'Adding a second vapor barrier inside. Two low-perm layers trap water between them.',
    are: 'PDD: Know that avoiding a double vapor barrier is a core moisture rule. The BCI table lists polyiso at 7.2 per inch, but this app uses 6.0.',
    more: [
      'Foam boards lose some R-value in cold weather. Check the manufacturer data for the temperatures your climate sees.',
    ],
    related: ['xps', 'vapor_classes', 'drying', 'continuous_insulation'],
    source: 'BCI 7.41, 7.46, building science practice',
    sourceKind: 'mixed',
  }),

  layer('ccspf', {
    title: 'Closed-cell spray foam',
    short: 'Sprayed foam that insulates and seals air leaks.',
    what: 'Closed-cell spray polyurethane foam (SPF) is sprayed in place. It expands and bonds to whatever it touches.',
    job: 'It gives R 6.0 per inch and fills odd gaps. Medium-density foam can serve as the air barrier. At 2 in. it passes 0.5 perm, so it also slows vapor.',
    control: 'thermal',
    ifWrong: 'Poor mixing or a cold, wet surface leads to weak bonding and shrinkage gaps. The foam burns, and a thick layer can block drying on one side.',
    doThis: 'Have trained installers spray it to the manufacturer limits. Cover it with a fire-resistant finish indoors. Check the retarder class against the climate zone.',
    products: ['Closed-cell spray polyurethane foam', 'Two-part kit foam for small gaps'],
    facts: [
      { label: 'R per inch', value: '6.0' },
      { label: 'R-value (2 in.)', value: '12' },
      { label: 'Permeance (perms)', value: '0.5 at 2 in. (approximate)' },
    ],
    mistake: 'Assuming every spray foam is the same. Open-cell foam has lower R and is far more vapor open.',
    are: 'PDD: Know that foamed-in-place insulation bonds to what it touches and suits odd-shaped voids. Know that plastic foams must sit behind a thermal barrier indoors.',
    more: [
      'Because it bonds and seals, one layer can be insulation, air barrier, and a partial vapor retarder at once. Count each role when you check the wall.',
    ],
    related: ['air_barrier', 'vapor_classes', 'continuous_insulation', 'drying'],
    source: 'BCI 7.41, 7.48, building science practice',
    sourceKind: 'mixed',
  }),

  layer('airspace', {
    title: 'Air space',
    short: 'Open gap that drains water and adds a little R.',
    what: 'An open gap with no material in it. Here it sits between the insulation and the brick, and it is often called the cavity.',
    job: 'It lets water that gets behind the brick run down to the flashing and out the weep holes. It is too wide for water to wick across. The app gives it R 0.97 at any thickness.',
    control: 'airspace',
    ifWrong: 'A gap that is too narrow or filled with mortar lets water bridge across to the wall behind. Blocked weep holes leave water standing at the base.',
    doThis: 'Keep at least 2 in. when insulation is in the cavity. Keep it clean of mortar. Add flashing and weep holes at the base, 24 in. o.c. in brick.',
    products: ['Open cavity behind brick', 'Cavity with a drainage mat or mortar-catching mesh'],
    facts: [
      { label: 'R-value', value: '0.97' },
      { label: 'Minimum width with cavity insulation', value: '2 in.' },
      { label: 'Weep holes', value: '24 in. o.c. in brick' },
    ],
    mistake: 'Letting mortar drop and pile up at the base. It blocks the weep holes and bridges the gap.',
    are: 'PDD: Know the gap sizes. At least 1 in. behind brick veneer on studs, at least 2 in. in a cavity wall, and at least 2 in. of open air space when insulation sits in the cavity.',
    more: [
      'A cavity vented to the outside may earn little or no R-value credit in real calculations. Check the adopted code and the energy standard.',
      'The cavity is the heart of a rainscreen. It also lets pressure on both sides of the cladding equalize.',
    ],
    related: ['drainage_gap', 'cavity', 'weep_holes', 'capillary_break', 'rainscreen'],
    source: 'BCI 5.23, 7.23, 7.28, 7.44, building science practice',
    sourceKind: 'mixed',
  }),

  // ------------------------------------------------------------------ water control
  layer('wrb', {
    title: 'Water-resistive barrier',
    short: 'Second line of defense that sheds water behind the cladding.',
    what: 'A thin layer on the sheathing behind the cladding. It can be a sheet, such as housewrap or felt, or a fluid-applied membrane.',
    job: 'Water that gets past the cladding runs down the WRB and out over the flashing. Many products also act as the air barrier. At about 30 perms the layer lets the wall dry outward.',
    control: 'water',
    ifWrong: 'If the layers lap the wrong way or tear, water runs behind them onto the sheathing. Gaps at windows let both water and air in.',
    doThis: 'Lap each upper layer over the lower one, like shingles. Tie it to the flashing. Tape seams and penetrations, and seal every seam if it is also the air barrier.',
    products: ['Housewrap sheet', 'Asphalt-saturated felt', 'Self-adhered membrane', 'Fluid-applied membrane'],
    facts: [
      { label: 'R-value', value: '0' },
      { label: 'Permeance (perms)', value: '30 (approximate)' },
      { label: 'Lap rule', value: 'Upper layer over lower' },
    ],
    mistake: 'Reverse lapping, where the upper layer is tucked behind the lower one. Water then runs behind the lower layer.',
    are: 'PDD: Know that exterior walls need an unbroken WRB behind the cladding and that flashing works with it. Know the four control layers and that one product can serve more than one.',
    more: [
      'The WRB is not the same as the air barrier, even when one product does both. The air barrier must be continuous and sealed at every seam.',
      'Flashing and the WRB work as one system. The WRB laps over the flashing so water always travels toward the outside.',
    ],
    related: ['wrb_concept', 'lap_joint', 'flashing', 'air_barrier', 'control_layers'],
    source: 'BCI 7.23, 7.28, 7.48, building science practice',
    sourceKind: 'mixed',
  }),

  // ------------------------------------------------------------------ cladding and masonry
  layer('brick', {
    title: 'Face brick, 3-5/8 in.',
    short: 'Masonry skin that sheds rain and lets the cavity drain.',
    what: 'Fired clay units laid in mortar. As a veneer it is a single layer, or wythe, held to the wall behind by metal ties.',
    job: 'It sheds most of the rain and shades the wall. Brick and mortar absorb some water, so the cavity, flashing, and weep holes carry away what gets through.',
    control: 'cladding',
    ifWrong: 'Water enters through the brick and mortar joints. Without flashing and weep holes, it collects at the base, heads, and sills and soaks the wall behind.',
    doThis: 'Flash the base, heads, and sills, and space weep holes 24 in. o.c. Keep the cavity open. Tool the mortar joints well and tie the brick back.',
    products: ['Clay face brick', 'Brick veneer with adjustable ties'],
    facts: [
      { label: 'R per inch', value: '0.11' },
      { label: 'R-value (3-5/8 in.)', value: '0.40' },
      { label: 'Permeance (perms)', value: '0.8' },
    ],
    mistake: 'Treating brick as waterproof. It is a rainscreen that sheds most water, not a seal.',
    are: 'PDD: Know that veneer is not bonded to the backup wall. Ties go no more than 16 in. horizontally and 24 in. vertically on stud walls. Flashing laps up behind the WRB.',
    more: [
      'Ties hold the veneer back against wind. Horizontal expansion joints under shelf angles and vertical joints divide the masonry into panels so it can move.',
      'At 0.8 perm brick passes little vapor. Water in the cavity mostly leaves by draining and by air moving in the gap.',
    ],
    related: ['rainscreen', 'weep_holes', 'flashing', 'brick_tie', 'shelf_angle'],
    source: 'BCI 5.23, 7.22, 7.28, 7.40, 7.45, building science practice',
    sourceKind: 'mixed',
  }),

  layer('cmu8', {
    title: 'CMU, 8 in.',
    short: 'Concrete block backup wall that carries load.',
    what: 'A concrete masonry unit (CMU) is a hollow concrete block. An 8 in. block laid in mortar makes a load-bearing wall.',
    job: 'It carries load and gives a rigid, fire-resistant backup wall behind brick. It also adds thermal mass, which slows temperature swings. The cores can hold loose fill or foam inserts.',
    control: 'structure',
    ifWrong: 'Block and mortar joints leak air, so a bare block wall is not an air barrier. Wet block is slow to dry and wicks water upward.',
    doThis: 'Add a continuous air barrier and WRB on the face. Flash the base and openings. Space flashing weep holes 32 in. o.c. for concrete masonry.',
    products: ['Hollow concrete block', 'Block with foam insert in the cores', 'Surface-bonded block wall'],
    facts: [
      { label: 'R-value (8 in.)', value: '1.11' },
      { label: 'Weep holes', value: '32 in. o.c. in CMU' },
      { label: 'Permeance (perms)', value: '2.4 (approximate)' },
    ],
    mistake: 'Calling a block wall airtight because it is heavy. Joints and cores leak unless they are coated or sealed.',
    are: 'PDD: Know that lightweight aggregate block reaches R 2.00 for an 8 in. unit against 1.11 for sand and gravel. Know that insulation can go in the cavity, in the cores, or on either face.',
    more: [
      'Mass helps in climates with big day and night swings. It matters less in steady hot and humid weather.',
      'The rainscreen backup wall must be airtight. A fluid-applied or self-adhered membrane on the block often does that job.',
    ],
    related: ['air_barrier', 'weep_holes', 'rainscreen', 'continuous_insulation', 'concrete'],
    source: 'BCI 5.23, 7.22, 7.23, 7.40, 7.44, ARE notes: Building envelope',
    sourceKind: 'ching',
  }),

  layer('concrete', {
    title: 'Concrete, sand and gravel',
    short: 'Dense structural mass with very low R.',
    what: 'Cast concrete made from cement, sand, and gravel. Here it can be a wall or a floor slab.',
    job: 'It carries load, resists fire, and stores heat. It is dense, so it resists heat flow very little. At 8 in. it reaches only R 0.64 and passes about 0.4 perm.',
    control: 'structure',
    ifWrong: 'A slab or wall that runs through the insulation conducts heat outward and chills the inside surface. Wet concrete dries very slowly.',
    doThis: 'Insulate on the outside or add insulation continuous around the concrete. Break the path with a thermal break where a slab crosses the wall.',
    products: ['Cast-in-place concrete', 'Precast concrete panel'],
    facts: [
      { label: 'R per inch', value: '0.08' },
      { label: 'R-value (8 in.)', value: '0.64' },
      { label: 'Permeance (perms)', value: '0.4 at 8 in. (approximate)' },
    ],
    mistake: 'Judging a concrete wall by its thickness. Even a foot of concrete adds less than R 1.',
    are: 'PDD: Know that mass alone is not insulation. Lightweight aggregate concrete reaches 0.60 per inch against 0.08 for sand and gravel.',
    more: [
      'A concrete slab edge that runs through the wall is one of the strongest thermal bridges in a building. The slab edge and balcony slab parts show it.',
    ],
    related: ['slab_edge', 'balcony_slab', 'thermal_break', 'thermal_bridge', 'cmu8'],
    source: 'BCI 7.40, 7.44, 7.45, building science practice',
    sourceKind: 'mixed',
  }),

  layer('fibercement', {
    title: 'Fiber-cement siding',
    short: 'Durable board siding that does not rot.',
    what: 'Boards made of cement and cellulose fibers, pressed flat. They are nailed or screwed to the studs as lapped siding.',
    job: 'It sheds rain and resists rot and insects better than wood. It is not waterproof, so the lap joints and edges still pass some water to the WRB.',
    control: 'cladding',
    ifWrong: 'Cut edges and joints take up water if left unsealed. Boards that touch the ground or roof wick water. Tight fits behind the board trap moisture.',
    doThis: 'Seal cut edges as the maker directs. Keep clearance above grade and roofs. Consider furring strips to form a drainage gap behind the siding.',
    products: ['Fiber-cement lap siding', 'Fiber-cement panel', 'Fiber-cement shingle'],
    facts: [
      { label: 'R-value', value: '0.15' },
      { label: 'Thickness', value: '5/16 in.' },
      { label: 'Permeance (perms)', value: '1.5 (approximate)' },
    ],
    mistake: 'Skipping the WRB behind it. The siding is only the first line of defense.',
    are: 'PDD: Know that cladding is the weather surface and is not always watertight. A rainscreen deliberately lets the WRB handle what gets past it.',
    more: [
      'A furred gap of at least 3/4 in. behind lapped siding forms a simple rainscreen. It drains and dries the back of the boards.',
    ],
    related: ['rainscreen', 'wrb', 'drainage_gap', 'vinyl'],
    source: 'BCI 7.23, 7.34, ARE notes: Building envelope, building science practice',
    sourceKind: 'mixed',
  }),

  layer('vinyl', {
    title: 'Vinyl siding',
    short: 'Lightweight plastic siding that lets the wall dry.',
    what: 'Plastic panels with nailing slots. They hang loosely from the studs and lap over each other.',
    job: 'The panels shed rain at the laps and stay light. At about 70 perms they are very open to vapor, so they never slow the wall drying outward. They also let some water pass behind.',
    control: 'cladding',
    ifWrong: 'Rain driven behind the panels hits the WRB. If the WRB is poor, water reaches the sheathing. Fasteners driven tight make the panels buckle.',
    doThis: 'Install a sound WRB behind the siding and flash the openings. Leave the nails loose so the panels slide with temperature changes.',
    products: ['Vinyl lap siding', 'Insulated vinyl siding'],
    facts: [
      { label: 'R-value', value: '1.00' },
      { label: 'Thickness', value: '1/2 in.' },
      { label: 'Permeance (perms)', value: '70 (approximate)' },
    ],
    mistake: 'Nailing the panels tight. They need to move as temperature changes.',
    are: 'PDD: Know that vinyl siding is rated R 1.00 in the BCI table. The WRB behind it is what keeps water out.',
    more: [
      'Because it is a loose, open cladding, vinyl relies completely on the WRB and the flashing behind it.',
    ],
    related: ['wrb', 'wrb_concept', 'fibercement', 'drying'],
    source: 'BCI 7.40, building science practice',
    sourceKind: 'mixed',
  }),

  layer('stucco', {
    title: 'Stucco, 7/8 in.',
    short: 'Hard cement skin that needs a drainage layer behind it.',
    what: 'Stucco is a coarse cement plaster applied wet. Over a stud wall it goes on metal lath in three coats.',
    job: 'It hardens into a weather-resistant and fire-resistant skin. It shrinks and cracks, so it is a drainage-strategy cladding: the layer behind it must shed water.',
    control: 'cladding',
    ifWrong: 'Cracks and joints let water in, and a tight fit to the WRB dries slowly. Paper and lath that touch each other leave no room for the plaster to wrap the lath.',
    doThis: 'Install waterproof building paper under the lath. Use lath that stands off 1/4 in. to 3/8 in. Flash openings, and consider a drainage gap or mat behind the stucco.',
    products: ['Portland cement stucco on metal lath', 'Stucco with a drainage mat behind it'],
    facts: [
      { label: 'R-value', value: '0.18' },
      { label: 'Thickness', value: '7/8 in.' },
      { label: 'Permeance (perms)', value: '5 (approximate)' },
    ],
    mistake: 'Treating stucco as the water barrier. The paper or WRB behind it does that job.',
    are: 'PDD: Know that stucco needs at least 7/8 in. thickness on lath and three coats over a stud wall. Know that over masonry it takes two coats directly on the wall.',
    more: [
      'Many codes ask for extra paper or a drainage space behind stucco. Check the adopted code.',
    ],
    related: ['wrb', 'drainage_gap', 'rainscreen', 'flashing'],
    source: 'BCI 7.23, 7.36, building science practice',
    sourceKind: 'mixed',
  }),

  // ------------------------------------------------------------------ framing materials
  layer('softwood', {
    title: 'Wood stud framing',
    short: 'Wood studs that carry the wall and bridge the insulation.',
    what: 'Softwood lumber framing, usually 2x4 or 2x6, set 16 in. or 24 in. on center between top and bottom plates.',
    job: 'The studs carry the loads and give a nailing base. Wood resists heat at only R 1.25 per inch, so a 5.5 in. stud is far weaker than the insulation beside it.',
    control: 'structure',
    ifWrong: 'Studs are a heat path through the insulation, so the wall loses more heat than the cavity R-value suggests. Wet studs rot.',
    doThis: 'Add continuous insulation outside the frame. Use deeper studs or wider spacing where practical. Keep the wood dry with a good WRB and an air barrier.',
    products: ['Dimension lumber studs', 'Engineered studs', 'Double stud wall'],
    facts: [
      { label: 'R per inch', value: '1.25' },
      { label: 'R-value (5.5 in.)', value: '6.9' },
      { label: 'Spacing', value: '16 or 24 in. o.c.' },
    ],
    mistake: 'Quoting only the batt R-value for a wood stud wall. The studs take about a quarter of the area.',
    are: 'PDD: Know that deeper studs, a double stud wall, or strapping give more room for insulation. Know that each stud bridges the cavity insulation.',
    more: [
      'Typical practice puts framing at about 25 percent of the wall at 16 in. spacing and about 22 percent at 24 in. This app uses those shares.',
    ],
    related: ['wood_stud', 'framing_effect', 'thermal_bridge', 'continuous_insulation', 'parallel_path'],
    source: 'BCI 5.43, 7.40, 7.44, building science practice',
    sourceKind: 'mixed',
  }),

  layer('steel', {
    title: 'Steel stud framing',
    short: 'Thin steel studs that conduct heat very well.',
    what: 'Light-gauge steel studs are cold-formed from thin sheet. They are C-shaped and sit between runner channels at top and bottom.',
    job: 'They are light and noncombustible. Steel resists heat at only R 0.0032 per inch, so thin studs still carry heat through the wall far faster than their area suggests.',
    control: 'structure',
    ifWrong: 'The steel bridges the insulation, so a steel stud wall often delivers about half of its nominal R-value or less. Cold stripes can appear on the inside face.',
    doThis: 'Put continuous insulation outside the studs. Use the effective R-value for the stud type and spacing. Keep the studs on the warm side of the main insulation.',
    products: ['C-shaped steel stud', 'Prepunched steel stud and track'],
    facts: [
      { label: 'R per inch', value: '0.0032' },
      { label: 'Effective R of a 6 in. R-19 cavity at 16 in. o.c.', value: '7.1' },
      { label: 'Spacing', value: '12, 16, or 24 in. o.c.' },
    ],
    mistake: 'Using the nominal batt R-value in a steel stud wall. The studs often cut it by half or more.',
    are: 'PDD: Know that steel framing is usually spaced 12, 16, or 24 in. on center. Know that continuous insulation is the fix for the thermal bridge.',
    more: [
      'Steel conducts about 400 times as well per inch as softwood. Its thinness keeps its area small, but it still dominates the heat flow.',
    ],
    related: ['steel_stud', 'framing_effect', 'thermal_bridge', 'continuous_insulation', 'aluminum'],
    source: 'BCI 5.39, 7.40, building science practice',
    sourceKind: 'mixed',
  }),

  layer('aluminum', {
    title: 'Aluminum framing',
    short: 'Light metal for window frames and curtain wall.',
    what: 'Aluminum is a light metal used for window frames, curtain wall mullions, and flashing.',
    job: 'It is strong, light, and does not rust. It resists heat at only R 0.0007 per inch, so a plain aluminum frame is a very strong heat path.',
    control: 'structure',
    ifWrong: 'On a cold day an unbroken aluminum frame can fall below the indoor dew point. Condensation then forms on the inside of the frame.',
    doThis: 'Use frames with a thermal break, a strip of low-conductivity material that splits the frame in two. Keep the inside half warm.',
    products: ['Thermally broken window frame', 'Aluminum mullion with a thermal break'],
    facts: [
      { label: 'R per inch', value: '0.0007' },
      { label: 'Thermal break material', value: 'Low-conductivity strip' },
    ],
    mistake: 'Choosing frames by looks alone. A frame with no break feels cold and sweats.',
    are: 'PPD: Know that windows and doors are the weakest thermal parts of an envelope. Know that a thermal break stops frame condensation.',
    more: [
      'Curtain wall needs a thermal break at each aluminum member to avoid thermal bridging and condensation.',
    ],
    related: ['thermal_break', 'thermal_bridge', 'dew_point', 'steel'],
    source: 'BCI 7.40, ARE notes: Building envelope',
    sourceKind: 'ching',
  }),
];

const CONCEPTS = [
  // ------------------------------------------------------------------ moisture and temperature
  concept('dew_point', {
    title: 'Dew point',
    short: 'The temperature where air starts to drop its water.',
    what: 'Warm air holds water as invisible vapor. Cool that air enough and the vapor turns into liquid drops. That temperature is the dew point.',
    job: 'If a surface inside the wall is colder than the dew point of the indoor air reaching it, water forms on that surface. Water inside a wall leads to rot, mold, rust, and wet insulation that stops working.',
    ifWrong: 'In this wall the sheathing is the first cold surface. In winter it is often below the dew point, so it is where the water shows up.',
    doThis: 'Keep the cold surface warm with insulation on its outside. Keep indoor air out with an air barrier and lower the indoor humidity. Let the wall dry to at least one side.',
    facts: [
      { label: 'Example', value: '70 °F at 35 % humidity gives about 41 °F' },
      { label: 'Rule', value: 'Surface below the dew point gets wet' },
      { label: 'Rises with', value: 'More indoor humidity' },
    ],
    mistake: 'Looking only at the air temperature. What matters is whether any surface in the wall is colder than the dew point.',
    are: 'PPD and PDD: Know that the dew point rises with humidity, and that exterior insulation moves the dew point outward, away from the sheathing.',
    more: [
      'Example from the app: indoor air at 70 °F and 35 % relative humidity has a dew point of about 41 °F. Any surface in the wall colder than 41 °F gets wet when that air touches it.',
      'Air leaks matter more than diffusion. Vapor creeps slowly through solid materials, but air moving through a small hole carries far more water into the wall. Seal the air leaks first.',
      'The direction changes with the season. In winter the indoor air is the wet side and the cold sheathing is the target. In a hot, humid summer, outdoor air at 90 °F and 70 % humidity has a dew point near 79 °F, so vapor drives inward and the cool back of the interior finish is the target.',
      'This app does a simple check. It compares the temperature of each layer face with the dew point. It does not calculate vapor flow, drying, or stored water, so use it to find the cold surface, not to prove a wall is safe.',
    ],
    related: ['condensation', 'relative_humidity', 'interior_surface_temp', 'air_leakage', 'vapor_retarder'],
    source: 'BCI 7.45, building science practice',
    sourceKind: 'mixed',
  }),

  concept('condensation', {
    title: 'Condensation',
    short: 'Vapor turning into liquid water on a cold surface.',
    what: 'Condensation is water vapor changing into liquid. It happens when air touches a surface colder than its dew point.',
    job: 'Inside a wall it wets insulation and sheathing where no one can see it. Wet insulation loses R-value, wet wood rots and grows mold, and steel rusts.',
    ifWrong: 'A small amount each winter adds up. The wall may show no stain until the sheathing is already soft.',
    doThis: 'Stop the supply with an air barrier, a vapor retarder, and lower indoor humidity. Warm the surface with insulation outside it. Let any water dry out through at least one side.',
    mistake: 'Fixing only the visible damage. Condensation inside a wall comes back until the cold surface or the supply of moist air changes.',
    are: 'PPD and PDD: Know where condensation forms. In an uninsulated wall it forms near the outer sheathing. In an insulated wall the dew point moves into the insulation layer.',
    more: [
      'The BCI drawing uses 70 °F and 30 % humidity inside and 0 °F outside. Without insulation the dew point falls at the outer sheathing. With insulation the temperature drops mostly across the insulation, so the dew point moves into it.',
      'Condensation can be on a surface or hidden. You see it on glass, but not inside a roof, wall, or floor cavity. The book gives two defenses: stop the vapor with a retarder, or release it by ventilation.',
    ],
    related: ['dew_point', 'vapor_retarder', 'air_leakage', 'drying', 'interior_surface_temp'],
    source: 'BCI 7.02, 7.45',
    sourceKind: 'ching',
  }),

  concept('relative_humidity', {
    title: 'Relative humidity',
    short: 'How full the air is compared with its limit.',
    what: 'Relative humidity (RH) is the water in the air compared with the most it could hold at that temperature. It is given as a percentage.',
    job: 'Warm air holds more water, so cooling air raises its RH even if no water is added. At 100 % RH the air is saturated and the temperature is the dew point.',
    ifWrong: 'Indoor air at 70 °F and 35 % RH reaches 100 % when cooled to about 41 °F. A wall surface at that temperature gets wet.',
    doThis: 'Keep indoor RH moderate. Comfort is usually 30 to 60 %. Use ventilation and exhaust fans to remove moisture where people cook, bathe, and breathe.',
    facts: [
      { label: 'Comfort range', value: '30 to 60 %' },
      { label: '70 °F at 50 %', value: 'Dew point about 51 °F' },
    ],
    mistake: 'Raising indoor humidity in a cold climate for comfort without checking the cold surfaces in the walls and windows.',
    are: 'PPD: Know that the comfort range is 30 to 60 % RH. Know that dry-bulb and wet-bulb temperatures show humidity, and that a large gap means dry air.',
    more: [
      'A higher indoor RH raises the dew point. In the app, the Inside humidity slider moves the dew point, and with it the layers that fall below it.',
    ],
    related: ['dew_point', 'condensation', 'interior_surface_temp', 'climate_zone'],
    source: 'ARE notes: Thermal envelope, building science practice',
    sourceKind: 'mixed',
  }),

  concept('interior_surface_temp', {
    title: 'Inside surface temperature',
    short: 'How warm the inside face of the wall feels.',
    what: 'The temperature of the inside face of the wall. It sits between the room air temperature and the outdoor temperature.',
    job: 'A wall with low U-factor keeps this surface close to room temperature. A cold surface feels uncomfortable and can fall below the room dew point, so mold and water form on it.',
    ifWrong: 'Cold corners, stud lines, and slab edges can drop below the dew point even when the wall is fine elsewhere. Stains and mold then follow the bridge.',
    doThis: 'Raise the wall R-value and cut thermal bridges. Add continuous insulation outside the frame. Check the lowest surface temperature, not just the average.',
    facts: [
      { label: 'Inside air film', value: 'R 0.68' },
      { label: 'Test', value: 'Lowest surface against the dew point' },
    ],
    mistake: 'Using the average wall temperature. Condensation starts at the coldest spot.',
    are: 'PPD: Know that thermal bridges and weak assemblies make cold inside surfaces. Know that frames without a thermal break can fall below the dew point.',
    more: [
      'The surface temperature is the room temperature minus the heat flow times the inside film resistance. Heat flow is high through a bridge, so the temperature there drops.',
      'In Thermal Bridge mode the Lowest surface value is this check. Compare it with the inside dew point shown beside it.',
    ],
    related: ['dew_point', 'thermal_bridge', 'u_factor', 'condensation', 'thermal_break'],
    source: 'ARE notes: Building envelope, building science practice',
    sourceKind: 'mixed',
  }),

  // ------------------------------------------------------------------ heat
  concept('r_value', {
    title: 'R-value',
    short: 'How strongly a layer resists heat flow. Higher is better.',
    what: 'R is thermal resistance, in h·ft²·°F/Btu. A thicker or better insulating layer has a higher R.',
    job: 'The R-values of layers in series add up. The total tells you how much heat the wall passes. More R means less heat loss, smaller equipment, and a warmer inside surface.',
    ifWrong: 'Quoting only the insulation overstates the wall. Studs, gaps, and squeezed batts lower the real value. Air films and air spaces add a little.',
    doThis: 'Add every layer plus the inside and outside air films. Then correct for framing. Use manufacturer data for real products.',
    facts: [
      { label: 'Series layers', value: 'Add the R-values' },
      { label: 'Per inch (1/k)', value: 'Multiply by thickness' },
      { label: 'Rule of thumb', value: 'About 1 per inch for most building materials' },
    ],
    mistake: 'Using R per inch for a layer whose R is given for its stated thickness, or the reverse.',
    are: 'PPD: Know R = d / k, and that Rt is the sum of layers. Know that a table value is either per inch (1/k) or for the stated thickness (1/C).',
    more: [
      'The app adds air films: R 0.68 inside, 0.17 outside in winter, and 0.25 outside in summer. They are part of the total.',
      'Rigid foam is the exception to the one per inch rule. Boards in this app range from R 3.8 to R 6.0 per inch.',
    ],
    related: ['u_factor', 'heat_flow', 'framing_effect', 'parallel_path', 'steady_state'],
    source: 'BCI 7.40, ARE notes: Thermal envelope',
    sourceKind: 'ching',
  }),

  concept('u_factor', {
    title: 'U-factor',
    short: 'Heat flow through a whole assembly. Lower is better.',
    what: 'U is 1 divided by the total R of an assembly. It is the heat that passes through one square foot for each degree of temperature difference.',
    job: 'Energy codes limit U or set minimum R-values. With U you can find the heat loss of any area. A lower U means less heat lost and a warmer inside surface.',
    ifWrong: 'A U-factor for the clear wall hides studs and bridges, so real losses are higher. A window U must include the frame and edges.',
    doThis: 'Add every layer, both air films, and any air spaces. Use the effective R for framed walls. Then take the inverse.',
    facts: [
      { label: 'Formula', value: 'U = 1 / Rt' },
      { label: 'Units', value: 'Btu/h·ft²·°F' },
    ],
    mistake: 'Leaving out the air films. They are part of Rt.',
    are: 'PPD: Know U = 1 / the sum of R, with air films included. Know that a lower U is better.',
    more: [
      'U is for the whole assembly. For a window, use the whole-window U, which includes frame and edge effects, and not the center-of-glass value.',
    ],
    related: ['r_value', 'heat_loss_q', 'framing_effect', 'parallel_path'],
    source: 'BCI 7.40, ARE notes: Thermal envelope',
    sourceKind: 'ching',
  }),

  concept('heat_flow', {
    title: 'Heat flow',
    short: 'Heat always moves from warm to cold.',
    what: 'Heat moves from warm to cold in three ways. It conducts through solids, it circulates in moving air, and it radiates between surfaces.',
    job: 'In winter, heat flowing out through the wall sets the heating load and the energy use. It also sets how cold each layer is, because more heat flowing means a bigger drop across a layer.',
    ifWrong: 'If you stop only one kind of flow, the others carry on. Insulation slows conduction but does nothing about air leaking through the wall.',
    doThis: 'Slow conduction with insulation, stop convection with an air barrier, and reflect radiation with a shiny low-emissivity surface facing an air space.',
    mistake: 'Treating insulation as the only tool. Air leaks and bridges carry heat around it.',
    are: 'PPD: Know that heat moves by conduction, convection, and radiation. Know that a foil face reflects heat only when it faces an air space at least 3/4 in. deep.',
    more: [
      'The heat flow arrows in the app show conduction. They bunch together at studs and slab edges, which are the easy paths.',
      'The temperature drop across a layer is its R times the heat flow. A high-R layer takes a large share of the total drop.',
    ],
    related: ['r_value', 'thermal_bridge', 'air_leakage', 'steady_state', 'heat_loss_q'],
    source: 'BCI 7.02, 7.41, 10.09, ARE notes: Thermal envelope',
    sourceKind: 'ching',
  }),

  concept('heat_loss_q', {
    title: 'Heat loss, Q',
    short: 'How many Btu per hour the wall loses.',
    what: 'Q is the rate of heat loss in Btu per hour. Conduction through the wall is U × A × ΔT. Air leakage is 1.08 × CFM × ΔT.',
    job: 'Q sizes the heating equipment and drives energy use. It shows how much of the loss comes from the wall area and R, and how much from leaking air.',
    ifWrong: 'Counting only conduction hides the loss from air leaks. In a leaky wall, air can be a large share of the total.',
    doThis: 'Calculate both. Use the effective U for framed walls. Reduce leakage with a continuous air barrier.',
    facts: [
      { label: 'Conduction', value: 'Q = U × A × ΔT' },
      { label: 'Air leakage', value: 'Q = 1.08 × CFM × ΔT' },
      { label: 'Units', value: 'Btu/h' },
    ],
    mistake: 'Using the area of the whole building for the wall term. Use the area of the wall only.',
    are: 'PPD: Know both formulas. A = area in ft², ΔT = inside minus outside temperature in °F, CFM = air leakage in cubic feet per minute.',
    more: [
      'The constant 1.08 comes from the density and heat capacity of air. When leakage is given in air changes per hour, use 0.018 × volume × ACH × ΔT.',
    ],
    related: ['u_factor', 'air_leakage', 'heat_flow', 'r_value'],
    source: 'BCI 7.40, ARE notes: Thermal envelope',
    sourceKind: 'ching',
  }),

  concept('steady_state', {
    title: 'Steady-state heat flow',
    short: 'A calculation that holds temperatures constant.',
    what: 'A steady-state calculation assumes the inside and outside temperatures stay fixed long enough for heat flow to settle.',
    job: 'It gives a simple, repeatable answer for R, U, and surface temperatures. It is the method the BCI uses. It ignores heat stored in the wall and daily changes.',
    ifWrong: 'Real walls store heat, and the sun and wind change every hour. A heavy wall delays heat flow, a time lag that a steady-state check cannot show.',
    doThis: 'Use the result to compare walls and find cold spots. For mass walls, sun, or fast weather changes, use a dynamic analysis.',
    mistake: 'Reading the numbers as what happens on any given day.',
    are: 'PPD: Know that the steady-state method rests on the total resistance and the air temperature difference. Know that mass causes a time lag.',
    more: [
      'The app solves the thermal bridge details with a two-dimensional steady-state grid. It gives a snapshot at the chosen temperatures.',
    ],
    related: ['r_value', 'heat_flow', 'u_factor', 'interior_surface_temp'],
    source: 'BCI 7.41',
    sourceKind: 'ching',
  }),

  concept('parallel_path', {
    title: 'Parallel path',
    short: 'Heat takes several routes at once.',
    what: 'In a framed wall, heat can go through the insulation or through the studs. These are parallel paths, each with its own R.',
    job: 'More heat takes the easy path. To find the wall average, weight the U-factor of each path by its share of the area, then invert.',
    ifWrong: 'Averaging the R-values gives too high an answer. The low-R path matters more than its area suggests.',
    doThis: 'Calculate U for each path, add them by area share, and take 1 divided by the sum. Use the framing shares for your stud spacing.',
    facts: [
      { label: 'Example', value: '80 % at R 10, 20 % at R 5' },
      { label: 'Average of R', value: '9.0 (wrong)' },
      { label: 'Average of U', value: '0.12, so R 8.3' },
    ],
    mistake: 'Averaging R-values by area. Always average U.',
    are: 'PDD: Know that the clear-wall R is higher than the whole-wall R because the studs conduct. Be able to explain why.',
    more: [
      'In this app a wood stud wall uses 25 % framing at 16 in. spacing and 22 % at 24 in. These are typical shares.',
    ],
    related: ['framing_effect', 'thermal_bridge', 'u_factor', 'r_value'],
    source: 'ARE notes: Thermal envelope, building science practice',
    sourceKind: 'mixed',
  }),

  concept('framing_effect', {
    title: 'Framing effect',
    short: 'Studs let heat bypass the insulation.',
    what: 'Studs take a share of the wall area and conduct heat better than the insulation. They lower the whole-wall R-value.',
    job: 'The wall delivers less than the cavity R-value suggests. Steel is the worst, because it conducts heat far better than wood. Even wood studs let more heat through than their share of the area suggests.',
    ifWrong: 'Counting only the batt overstates the wall. The effect shows up as cold stripes on the inside surface at each stud.',
    doThis: 'Use the whole-wall R-value. Add continuous insulation outside the frame. Use fewer or deeper studs where practical.',
    facts: [
      { label: 'Wood framing share', value: 'About 25 % at 16 in. o.c., 22 % at 24 in.' },
      { label: 'Steel R-19 cavity, 6 in., 16 in. o.c.', value: 'Effective R 7.1' },
    ],
    mistake: 'Using the R-value printed on the batt as the R-value of the wall.',
    are: 'PDD: Know that framing members create thermal bridges and that continuous insulation outboard of the structure reduces them.',
    more: [
      'In this app a steel stud wall with R-19 batts at 16 in. spacing counts as only R 7.1 for the cavity layer. The effective values come from a table.',
    ],
    related: ['thermal_bridge', 'parallel_path', 'continuous_insulation', 'wood_stud', 'steel_stud'],
    source: 'BCI 7.44, ARE notes: Thermal envelope, building science practice',
    sourceKind: 'mixed',
  }),

  concept('thermal_bridge', {
    title: 'Thermal bridge',
    short: 'A path that carries heat around the insulation.',
    what: 'A thermal bridge is a part of the wall that conducts heat much better than the insulation beside it. Studs, slab edges, and shelf angles are examples.',
    job: 'Heat takes the easy path, so a small bridge can add a large share of the wall heat loss. The inside surface at the bridge is also colder, which can drop below the dew point.',
    ifWrong: 'A wall can look well insulated on paper and still lose far more heat. Cold lines, mold, and condensation can appear where the bridge meets the inside face.',
    doThis: 'Keep the insulation continuous across the structure. Break unavoidable paths with a thermal break. Use the Thermal Bridge mode to compare details.',
    mistake: 'Checking only the clear wall. The bridges set the real heat loss.',
    are: 'PPD and PDD: Know that structural members passing through insulation create thermal bridges. Know that continuous insulation outboard of the frame reduces them.',
    more: [
      'The Heat loss increase value in the app shows how much more the detail loses than the same wall with no bridge.',
      'Steel and concrete are the strongest bridges. Wood is a weaker one, and it is still enough to matter.',
    ],
    related: ['framing_effect', 'thermal_break', 'continuous_insulation', 'interior_surface_temp', 'parallel_path'],
    source: 'ARE notes: Thermal envelope, BCI 7.39, building science practice',
    sourceKind: 'mixed',
  }),

  concept('continuous_insulation', {
    title: 'Continuous insulation',
    short: 'Insulation that runs unbroken outside the frame.',
    what: 'Continuous insulation (CI) is a layer of insulation that covers the framing and the sheathing without a break. Rigid foam or mineral wool board are common forms.',
    job: 'It covers the studs, so the frame no longer bridges the cavity insulation. It also keeps the sheathing warm, which moves the dew point outward, away from the wood.',
    ifWrong: 'If the CI is cut short or fixed with many metal clips, heat leaks through the gaps. A low-perm CI also blocks outward drying.',
    doThis: 'Run it unbroken past floor edges and roof edges. Check its perm against the interior retarder rule. Use attachments that keep metal penetrations small.',
    facts: [
      { label: 'Steel stud detail', value: '2 in. CI in the Thermal Bridge mode' },
      { label: 'Foam under 1 perm', value: 'Interior Class III only' },
    ],
    mistake: 'Adding CI and keeping a Class I or II retarder inside a wall with foam under 1 perm.',
    are: 'PDD: Know that CI reduces thermal bridging and that insulation must stay continuous at floor and roof edges.',
    more: [
      'The W2, W3, and W4 wall presets in this app put continuous insulation outside the backup wall so you can see the dew point move.',
    ],
    related: ['thermal_bridge', 'xps', 'minwool', 'dew_point', 'vapor_classes'],
    source: 'BCI 7.44, 7.46, ARE notes: Building envelope, building science practice',
    sourceKind: 'mixed',
  }),

  concept('thermal_break', {
    title: 'Thermal break',
    short: 'A low-conductivity piece that cuts a heat path.',
    what: 'A thermal break is a piece of low-conductivity material placed in an otherwise conductive path.',
    job: 'It cuts the flow of heat through metal frames, slab edges, and other bridges. That cuts heat loss and keeps the inside surface above the dew point.',
    ifWrong: 'Without the break, a frame or slab edge can be cold enough to sweat. With a poor break, steel bars or ties through it carry back some of the heat.',
    doThis: 'Use frames with polyamide or similar breaks, and structural break units where a slab crosses the wall. Check the manufacturer data for the tested value.',
    mistake: 'Putting the break in the wrong plane, so heat still has a continuous path around it.',
    are: 'PPD: Know that window frames and curtain wall members need a thermal break to avoid condensation on the inside frame.',
    more: [
      'The slab with a thermal break detail in the app uses a 2 in. break in line with the insulation. Its steel bars give back a little of the benefit.',
    ],
    related: ['thermal_bridge', 'thermal_break_unit', 'slab_edge', 'aluminum', 'balcony_slab'],
    source: 'ARE notes: Building envelope, building science practice',
    sourceKind: 'mixed',
  }),

  // ------------------------------------------------------------------ vapor and air
  concept('vapor_retarder', {
    title: 'Vapor retarder',
    short: 'A layer that slows water vapor.',
    what: 'A vapor retarder is a layer with low permeance, so it lets very little vapor through. A perm measures how much vapor passes.',
    job: 'On the warm side of the insulation, it keeps vapor from reaching a surface cold enough to condense it. The more insulation and the bigger the temperature gap, the more it matters.',
    ifWrong: 'Missing in a cold climate, vapor reaches the cold sheathing. On the wrong side, or doubled, it traps water in the wall and prevents drying.',
    doThis: 'Pick the class by climate zone and put it on the warm side. Leave at least one drying direction. Follow the adopted code and the manufacturer.',
    facts: [
      { label: 'Cold climate', value: 'Inside, on the warm side' },
      { label: 'Hot-humid climate', value: 'Do not use Class I or II inside' },
    ],
    mistake: 'Adding a second vapor barrier. Two low-perm layers trap water between them.',
    are: 'PDD: Know that a vapor retarder goes on the warm side of the insulation, and that avoiding double vapor barriers is a core rule.',
    more: [
      'A vapor retarder is not an air barrier. Air that leaks through a small hole carries far more moisture than diffusion through the whole sheet.',
      'The outer layers should let vapor through, so any moisture in the wall can dry outward.',
    ],
    related: ['vapor_classes', 'air_barrier', 'drying', 'dew_point', 'climate_zone'],
    source: 'BCI 7.45, 7.46, 7.48, ARE notes: Building envelope',
    sourceKind: 'ching',
  }),

  concept('vapor_classes', {
    title: 'Vapor retarder classes',
    short: 'Classes I, II, and III sort retarders by perm.',
    what: 'The code sorts retarders into three classes by permeance. Class I is nearly vapor-tight and Class III is the most open.',
    job: 'The climate zone decides which class is allowed on the inside of a frame wall. The right class lets the wall dry and still protects it from winter vapor.',
    ifWrong: 'A Class I or II retarder inside a hot, humid wall traps vapor driven inward in summer. The wrong class in a cold zone lets winter vapor reach the sheathing.',
    doThis: 'Check the class against the zone rules the app shows. Use only Class III inside if exterior foam is under 1 perm. Check the adopted code.',
    facts: [
      { label: 'Class I', value: '0.1 perm or less (poly sheet, foil)' },
      { label: 'Class II', value: 'Above 0.1, up to 1.0 (kraft-faced batt)' },
      { label: 'Class III', value: 'Above 1.0, up to 10 (latex paint)' },
      { label: 'Zones 1 and 2', value: 'No Class I or II inside' },
    ],
    mistake: 'Specifying Class I everywhere. It is wrong in the hot-humid zones.',
    are: 'PDD: Know the class limits and where each is allowed. Zones 5 to 8 and Marine 4 need Class I or II inside. Zones 3 and 4 do not allow Class I inside.',
    more: [
      'Rule summary in the app: zones 1 and 2 no Class I or II inside. Zones 3 and 4 no Class I inside. Marine 4 and zones 5 to 8 need Class I or II inside.',
      'If foam sheathing under 1 perm covers the outside of a frame wall, only Class III is allowed inside. The class rules apply to frame walls only.',
    ],
    related: ['vapor_retarder', 'climate_zone', 'xps', 'drying'],
    source: 'BCI 7.46',
    sourceKind: 'ching',
  }),

  concept('air_leakage', {
    title: 'Air leakage',
    short: 'Air carries far more water through gaps than vapor does.',
    what: 'Air leakage is air moving through cracks, holes, and joints in the wall because of a pressure difference.',
    job: 'The moving air carries heat and moisture. Almost all the vapor that enters a wall cavity rides on air. A small hole in drywall can move more moisture than diffusion through the whole sheet.',
    ifWrong: 'Warm, humid indoor air reaches the cold sheathing and condenses there. The wall can get wet in a single winter even with a good vapor retarder.',
    doThis: 'Build a continuous air barrier and seal every seam and penetration. Test with a blower door and find leaks with a smoke pencil.',
    facts: [
      { label: 'Heat loss from leaks', value: 'Q = 1.08 × CFM × ΔT' },
      { label: 'Test', value: 'Blower door, then smoke pencil' },
    ],
    mistake: 'Fixing vapor and ignoring air. Air leaks carry far more water than diffusion.',
    are: 'PDD: Know that air leakage carries far more moisture than vapor diffusion, and that a blower door and smoke pencil find the leaks.',
    more: [
      'Airtightness typically has a larger effect on energy use and moisture than adding more insulation.',
    ],
    related: ['air_barrier', 'dew_point', 'condensation', 'heat_loss_q', 'vapor_retarder'],
    source: 'BCI 7.48, ARE notes: Building envelope, Thermal envelope',
    sourceKind: 'ching',
  }),

  concept('air_barrier', {
    title: 'Air barrier',
    short: 'A sealed layer that stops air moving through the wall.',
    what: 'An air barrier is a continuous layer that stops air from moving through the envelope when the inside and outside pressures differ.',
    job: 'It keeps humid indoor air out of the cold parts of the wall. It must be continuous across the whole envelope, including joints between wall, roof, and foundation. It must also stand up to wind pressure.',
    ifWrong: 'Any gap becomes a leak path. One open penetration cuts the performance of the whole barrier sharply.',
    doThis: 'Choose a layer you can seal: a membrane, a fluid-applied coating, spray foam, taped boards, or sealed gypsum board. Seal every seam and penetration. Place an outside barrier so it lets vapor through.',
    facts: [
      { label: 'Forms', value: 'Sheet, fluid-applied, or board' },
      { label: 'One layer can do three jobs', value: 'Air barrier, WRB, vapor retarder' },
    ],
    mistake: 'Leaving unsealed penetrations, seams, and transitions. The barrier is only as good as its worst opening.',
    are: 'PDD: Know that an air barrier and a vapor retarder are different, that an air barrier can be vapor permeable, and that it must be continuous.',
    more: [
      'A single layer can be the air barrier, the WRB, and the vapor retarder. Building wrap, a liquid membrane, or a self-adhered sheet can do all three.',
      'The barrier ties into the flashing so that water from rain stays out. Do not skip the transitions.',
    ],
    related: ['air_leakage', 'wrb_concept', 'control_layers', 'vapor_retarder', 'flashing'],
    source: 'BCI 7.48, ARE notes: Building envelope',
    sourceKind: 'ching',
  }),

  concept('control_layers', {
    title: 'Control layers',
    short: 'Each layer in a wall has a job to do.',
    what: 'A wall has control layers for water, air, vapor, and heat. Each layer has one or more of these jobs.',
    job: 'Naming the jobs shows what is missing. The WRB sheds bulk water, the air barrier stops air flow, the vapor retarder slows diffusion, and the insulation slows heat. The cladding is the weather surface.',
    ifWrong: 'A missing layer leaves a job undone. A layer in the wrong place, such as a low-perm layer on the cold side, can trap water.',
    doThis: 'List the layers from inside to outside. Mark which layer does each job. Make sure each is continuous and that the wall can dry to at least one side.',
    facts: [
      { label: 'Water', value: 'WRB and flashing' },
      { label: 'Air', value: 'Sealed membrane, foam, or board' },
      { label: 'Vapor', value: 'Retarder on the warm side' },
      { label: 'Heat', value: 'Insulation, ideally continuous' },
    ],
    mistake: 'Assuming each job needs a separate layer. One product can do several, but each job must still be continuous.',
    are: 'PPD and PDD: Know the four roles of the envelope: structure, thermal control, moisture control, and air barrier. Know the WRB is the last line of defense before bulk water enters.',
    more: [
      'The layer tags in the app use these jobs. A product can carry more than one tag in practice, such as taped foam that is also the air barrier.',
    ],
    related: ['air_barrier', 'wrb_concept', 'vapor_retarder', 'continuous_insulation', 'drying'],
    source: 'ARE notes: Building envelope, BCI 7.48',
    sourceKind: 'ching',
  }),

  concept('drying', {
    title: 'Drying',
    short: 'How water that gets in leaves the wall.',
    what: 'Drying is moisture leaving the wall by vapor moving to a drier side, by air moving through, or by draining as liquid.',
    job: 'Every wall gets some water. A wall that can dry stays safe. A wall that cannot, because both sides are blocked, collects water until something rots.',
    ifWrong: 'Two low-perm layers trap water between them. A foam under 1 perm outside blocks outward drying, and a vapor-tight layer inside blocks inward drying.',
    doThis: 'Design the wall to drain bulk water and dry in at least one direction. Keep the outer layers vapor open. Use a ventilated or drained cavity behind cladding.',
    mistake: 'Making a wall vapor-tight on both sides. It cannot dry if it ever gets wet.',
    are: 'PDD: Know the rule to drain and dry, and to avoid a double vapor barrier. Know that foam under 1 perm outside means the wall dries inward.',
    more: [
      'The app does not model drying. It shows where cold surfaces are, and the perm values show which way a wall could dry.',
      'A cavity with a gap behind the cladding is ventilated from behind, so trapped water can dry.',
    ],
    related: ['vapor_retarder', 'vapor_classes', 'rainscreen', 'drainage_gap', 'xps'],
    source: 'BCI 5.46, 7.23, 7.46, ARE notes: Building envelope',
    sourceKind: 'ching',
  }),

  concept('climate_zone', {
    title: 'Climate zone',
    short: 'The code sorts places by temperature and humidity.',
    what: 'The International Energy Conservation Code (IECC) sorts places into climate zones 1 to 8, with a Marine 4 zone. Zone 1 is the hottest and zone 8 is the coldest.',
    job: 'The zone affects which way vapor drives and which vapor retarder class is allowed on the inside. It also sets minimum insulation levels.',
    ifWrong: 'The same wall can work in one zone and fail in another. A Class I retarder inside is right in the cold zones and wrong in the hot-humid zones.',
    doThis: 'Look up the zone for the site. Apply the retarder rules and the R-value minimums. Check the adopted code, because local rules vary.',
    facts: [
      { label: 'Zone 1 and 2', value: 'Hot and humid' },
      { label: 'Zones 3 and 4', value: 'Mixed' },
      { label: 'Marine 4 and zones 5 to 8', value: 'Cold to subarctic' },
      { label: 'Wall minimum R (2018 IECC, BCI)', value: '13 in zones 1 to 4, 20 in 5 and 6, 21 in 7 and 8' },
    ],
    mistake: 'Copying a wall from a different climate zone.',
    are: 'PPD: Know that the zone decides the vapor retarder class and the insulation minimums. Know that minimum R-values come from the IECC tables.',
    more: [
      'In the app, the climate zone control drives the retarder check. Choose a zone and the class rules update.',
    ],
    related: ['vapor_classes', 'vapor_retarder', 'dew_point', 'relative_humidity'],
    source: 'BCI 7.39, 7.46',
    sourceKind: 'ching',
  }),

  // ------------------------------------------------------------------ water
  concept('wrb_concept', {
    title: 'Water-resistive barrier and drainage plane',
    short: 'A lapped layer that sends water down and out.',
    what: 'The water-resistive barrier is the layer behind the cladding that stops liquid water from reaching the sheathing. Together with flashing, it forms the drainage plane.',
    job: 'It is the last line of defense before bulk water enters the structure. Water that gets past the cladding runs down it and out the bottom, over the flashing.',
    ifWrong: 'A tear, a reverse lap, or a missing seam at a window sends water behind the layer. The water then wets the sheathing where it is hidden.',
    doThis: 'Lap every layer over the one below it, like shingles. Tie it to flashing at heads, sills, and the base. Seal seams and penetrations.',
    facts: [
      { label: 'Minimum', value: 'One layer of asphalt felt' },
      { label: 'Lap order', value: 'Upper over lower' },
    ],
    mistake: 'Reverse lapping, which makes water run behind the lower layer.',
    are: 'PDD: Know that exterior walls need an unbroken WRB behind the cladding, with flashing, and that rainscreen cladding relies on it to handle what gets past.',
    more: [
      'Many air barrier products also act as the WRB. Where one layer does both, the seams must be sealed for air and lapped for water.',
    ],
    related: ['wrb', 'lap_joint', 'flashing', 'drainage_gap', 'rainscreen'],
    source: 'BCI 7.23, 7.48, ARE notes: Building envelope',
    sourceKind: 'ching',
  }),

  concept('flashing', {
    title: 'Flashing',
    short: 'Sheet metal or membrane that catches water and sends it out.',
    what: 'Flashing is sheet material that catches water that gets into a wall and sends it back outside. It is placed at heads, sills, bases, and other weak spots.',
    job: 'Water runs down inside the wall and collects at every opening and at the base. Flashing catches it and weep holes let it out. Flashing failures cause most moisture callbacks.',
    ifWrong: 'Without flashing, water runs onto the window head, into the rough opening, or onto the base of the wall. It soaks the wall, where it rots framing and sheathing.',
    doThis: 'Flash heads, sills, the base, and any change in material. Turn the head flashing up 2 in. and drip it 3/4 in. past the face. Lap the WRB over the flashing.',
    facts: [
      { label: 'Head flashing turn-up', value: '2 in.' },
      { label: 'Drip projection', value: '3/4 in. past the face, turned down 45°' },
      { label: 'Weep holes', value: '24 in. o.c. in brick, 32 in. in CMU' },
    ],
    mistake: 'Leaving flashing out above a window, or letting the WRB lap behind it.',
    are: 'PDD: Know where flashing goes and the numbers: a 2 in. turn-up, a 3/4 in. drip, and weep holes just above the flashing.',
    more: [
      'Flashing needs weep holes. Every masonry flashing must lead water to weep holes, which are open head joints in the course just above it.',
      'Walls need flashing wherever leaks are likely: door and window openings and seams between different materials.',
    ],
    related: ['head_flashing', 'sill_pan', 'base_flashing', 'weep_holes', 'drip_edge'],
    source: 'BCI 7.02, 7.22, 7.28, ARE notes: Building envelope',
    sourceKind: 'ching',
  }),

  concept('weep_holes', {
    title: 'Weep holes',
    short: 'Small openings that let trapped water out.',
    what: 'Weep holes are open spaces at the bottom of a masonry wall. They are usually open head joints in the course just above the flashing.',
    job: 'They let water that ran down the cavity escape to the outside. Without them the water stands on the flashing and soaks the wall base.',
    ifWrong: 'If weep holes are missing or blocked, the base of the cavity fills with water. The wall soaks and the water finds its way inside.',
    doThis: 'Place weep holes just above the flashing. Space them 24 in. o.c. in brick and 32 in. o.c. in concrete masonry. Keep them free of mortar.',
    facts: [
      { label: 'Brick', value: '24 in. o.c.' },
      { label: 'Concrete masonry', value: '32 in. o.c.' },
      { label: 'Position', value: 'Just above the flashing' },
    ],
    mistake: 'Putting weep holes below the flashing, or letting mortar block them.',
    are: 'PDD: Know where weep holes go and why. They sit just above the flashing so the flashing carries water to them.',
    more: [
      'Some details use insect screen or a vent product in the open joint. The opening stays clear for air and water.',
    ],
    related: ['flashing', 'base_flashing', 'cavity', 'brick', 'rainscreen'],
    source: 'BCI 5.23, 7.22, 7.23',
    sourceKind: 'ching',
  }),

  concept('drainage_gap', {
    title: 'Drainage gap',
    short: 'An open gap behind the cladding so water can fall.',
    what: 'A drainage gap is open space between the cladding and the WRB. It is a gap behind brick, or a gap formed by furring strips behind siding.',
    job: 'It breaks the contact between the cladding and the wall. Water that gets behind the cladding runs down instead of wicking across, and the gap lets the back of the cladding dry.',
    ifWrong: 'If the cladding touches the WRB, capillary action holds water in the contact. It wets the sheathing over a wide area.',
    doThis: 'Keep the gap clear of debris. Size it for the cladding: 3/4 in. minimum for furred siding, 1 in. behind brick veneer, and 2 in. with insulation.',
    facts: [
      { label: 'Furred siding', value: '3/4 in. minimum' },
      { label: 'Brick veneer on studs', value: '1 in. minimum' },
      { label: 'Cavity with insulation', value: '2 in. minimum' },
    ],
    mistake: 'Letting mortar or insulation bridge the gap.',
    are: 'PDD: Know the gap sizes and why: the cavity must be wide enough that water cannot wick across it.',
    more: [
      'The No drainage gap error in the Water mode shows what happens when the cladding touches the WRB.',
    ],
    related: ['rainscreen', 'capillary_break', 'cavity', 'airspace', 'wrb_concept'],
    source: 'BCI 5.23, 7.23, 7.28, 7.34, 7.44',
    sourceKind: 'ching',
  }),

  concept('capillary_break', {
    title: 'Capillary break',
    short: 'A gap too wide for water to cross by wicking.',
    what: 'Capillary action pulls water through a narrow gap, even uphill. A capillary break is an air gap wider than the water film.',
    job: 'It cuts off the wicking path. In a rainscreen the cavity is too wide for water to bridge, so the water falls and drains.',
    ifWrong: 'Water wicks through tight joints and contacts, and reaches the backup wall. It can climb above the point where it first got in.',
    doThis: 'Leave an open gap in joints and behind cladding. Keep the cavity clear of mortar. Do not let materials touch where water collects.',
    facts: [
      { label: 'Force', value: 'Capillary action' },
      { label: 'Defense', value: 'Air gap wider than the water film' },
    ],
    mistake: 'Filling a gap with sealant or insulation that touches both sides.',
    are: 'PDD: Know the five forces that drive water in and the defense for each. The capillary defense is a break or an air gap.',
    more: [
      'The Forces view in the Water mode shows the capillary break in a joint, next to the other four forces.',
    ],
    related: ['drainage_gap', 'rainscreen', 'cavity', 'drip_edge'],
    source: 'BCI 7.23',
    sourceKind: 'ching',
  }),

  concept('rainscreen', {
    title: 'Rainscreen wall',
    short: 'Cladding, then a gap, then a sealed backup wall.',
    what: 'A rainscreen wall has outer cladding, an air cavity, and a drainage plane on an airtight backup wall. A brick cavity wall is one.',
    job: 'The cladding stops most rain. The cavity carries off what gets past and is too wide for water to wick across. If the cavity is vented, the pressure on both sides of the cladding equalizes so the air pressure cannot push water in.',
    ifWrong: 'A cavity without flashing, weep holes, or an airtight backup wall fails to drain or lets water through. A rainscreen costs more, so poor details waste that cost.',
    doThis: 'Put the air barrier and insulation on the room side of the cavity. Flash the base and openings, and add weep holes. Keep the cavity clear.',
    facts: [
      { label: 'Weather side', value: 'Vented cladding and cavity' },
      { label: 'Room side', value: 'Air barrier and insulation' },
    ],
    mistake: 'Calling any gap behind cladding a rainscreen. It needs drainage, flashing, and an airtight backup wall.',
    are: 'PDD: Know the four ways walls handle water: mass, barrier, drainage, and rainscreen. Know that pressure-equalized rainscreen vents the cavity.',
    more: [
      'The five forces are raindrop momentum, gravity, surface tension, capillary action, and air pressure difference. A rainscreen answers all of them.',
      'Rainscreen is considered best practice for most wall types because it separates the cladding from the WRB.',
    ],
    related: ['drainage_gap', 'capillary_break', 'weep_holes', 'cavity', 'flashing'],
    source: 'BCI 7.23, ARE notes: Building envelope',
    sourceKind: 'ching',
  }),

  // ------------------------------------------------------------------ drawing
  concept('exploded_view', {
    title: 'Exploded view',
    short: 'The layers pulled apart so you can see each one.',
    what: 'An exploded view moves the layers apart along the wall depth so each one is visible. In the real wall the layers touch.',
    job: 'The order of the layers decides where water forms and how the wall dries. Pulling them apart lets you read each layer and its job.',
    ifWrong: 'The gaps in an exploded view are not real. Reading them as air spaces gives the wrong picture of the wall.',
    doThis: 'Read the layers from inside to outside. Name each layer and its job. Close the view to see how the layers sit together.',
    mistake: 'Taking the spacing as real air gaps.',
    are: 'PDD: Know how to read a wall section from inside to outside. The BCI uses exploded views to show the parts of an insulation system.',
    more: [
      'The BCI uses an exploded view to set each insulation form beside a note about it.',
    ],
    related: ['section_cut', 'control_layers', 'drying'],
    source: 'BCI 7.41, building science practice',
    sourceKind: 'mixed',
  }),

  concept('section_cut', {
    title: 'Section cut',
    short: 'An imaginary slice through the wall.',
    what: 'A section cut is an imaginary slice through the wall that shows the layers from the side. A plan cut slices level, as through a stud bay.',
    job: 'Where you cut changes what you see. A cut through the cavity shows the insulation path. A cut through a stud shows the framing path.',
    ifWrong: 'Reading only one cut gives one answer. The wall behaves differently at the stud and at the cavity.',
    doThis: 'Look at more than one cut. In Thermal Bridge mode, compare the cavity and the bridge. Use the temperature map to see the difference.',
    mistake: 'Treating one section as the whole wall.',
    are: 'PDD: Know how to read wall sections and details, and how to draw them to show the layers and where the bridges are.',
    more: [
      'The Thermal Bridge mode uses a plan cut for the stud and vertical sections for the slab edge and the shelf angle.',
    ],
    related: ['exploded_view', 'thermal_bridge', 'parallel_path'],
    source: 'Building science practice',
    sourceKind: 'general',
  }),
];

const PARTS = [
  // ------------------------------------------------------------------ thermal bridge parts
  part('wood_stud', {
    title: 'Wood stud',
    short: 'A wood stud is a weak heat path beside the batt.',
    what: 'A vertical wood member in the wall, 1-1/2 in. wide, spaced 16 in. or 24 in. on center. In the plan cut it runs across the whole cavity.',
    job: 'It carries the load and gives a nailing base. Wood resists heat at only R 1.25 per inch, far less than the insulation beside it, so heat passes through the stud easily.',
    ifWrong: 'Each stud draws heat out of the room. The inside face over a stud is a little colder, and the wall loses more than the batt R-value suggests.',
    doThis: 'Add continuous insulation outside the frame. Use 24 in. spacing or deeper studs where practical. Keep studs dry.',
    products: ['Dimension lumber stud', 'Engineered stud', 'Double stud wall'],
    facts: [
      { label: 'Width in the model', value: '1-1/2 in.' },
      { label: 'Spacing', value: '16 or 24 in. o.c.' },
      { label: 'Typical framing share', value: '25 % at 16 in., 22 % at 24 in.' },
    ],
    mistake: 'Treating the stud as a minor detail. It is about a quarter of the wall area.',
    are: 'PDD: Know that studs are 2x members at 16 or 24 in. on center, and that deeper studs or strapping allow more insulation.',
    more: [
      'Wood is a weaker bridge than steel. In the app compare the wood stud with the steel stud and the heat loss increase of each.',
    ],
    related: ['softwood', 'framing_effect', 'thermal_bridge', 'continuous_insulation'],
    source: 'BCI 5.43, 7.40, 7.44, building science practice',
    sourceKind: 'mixed',
  }),

  part('steel_stud', {
    title: 'Steel stud',
    short: 'A thin steel stud that carries heat through the wall.',
    what: 'A C-shaped light-gauge steel member. In the model the web is 0.045 in. thick and the flanges are about 1-5/8 in. wide.',
    job: 'It is light and does not burn. Steel conducts heat far better than the insulation, so even this thin metal carries heat across the cavity and along the flanges.',
    ifWrong: 'The studs cut the effective R-value of the cavity to a fraction of the batt. The inside face shows cold stripes at each stud, which may fall below the dew point.',
    doThis: 'Put continuous insulation outside the studs. Use the effective R-value for the stud depth and spacing. Check the lowest surface temperature.',
    products: ['C-shaped steel stud', 'Prepunched steel stud and track'],
    facts: [
      { label: 'Web thickness in the model', value: '0.045 in.' },
      { label: 'Flange width', value: 'About 1-5/8 in.' },
      { label: 'Effective R of R-19, 6 in., 16 in. o.c.', value: '7.1' },
    ],
    mistake: 'Reading the batt label as the wall R-value. For steel studs the real value is often half or less.',
    are: 'PDD: Know that a steel stud wall needs exterior continuous insulation to limit the thermal bridge.',
    more: [
      'The Steel stud plus 2 in. continuous insulation variant in the app covers the studs. It raises the inside surface temperature and cuts the heat loss increase.',
    ],
    related: ['steel', 'framing_effect', 'thermal_bridge', 'continuous_insulation', 'minwool'],
    source: 'BCI 5.39, 7.44, building science practice',
    sourceKind: 'mixed',
  }),

  part('slab_edge', {
    title: 'Slab edge',
    short: 'The concrete floor edge crossing the insulated wall.',
    what: 'In the model an 8 in. concrete floor slab meets a brick wall with continuous insulation. The slab crosses the wall behind the brick.',
    job: 'Concrete resists heat very little. If the slab runs through the insulation line, it carries heat outward and chills the floor edge inside.',
    ifWrong: 'The cold slab makes a cold line along the floor, so condensation and mold can form there. It also raises the wall heat loss a lot.',
    doThis: 'Keep the slab behind the insulation line where the structure allows, or add a thermal break. Keep the insulation continuous.',
    products: ['Cast-in-place slab', 'Precast floor slab', 'Insulated slab edge form'],
    facts: [
      { label: 'Slab thickness in the model', value: '8 in.' },
      { label: 'Concrete R per inch', value: '0.08' },
    ],
    mistake: 'Letting the slab pass through the insulation with no break.',
    are: 'PDD: Know that insulation must run unbroken where floor and wall meet, and that any gap lets heat bypass the envelope.',
    more: [
      'The Slab through the insulation variant shows the worst case. The Slab with a thermal break variant shows how a break helps.',
    ],
    related: ['concrete', 'balcony_slab', 'thermal_break', 'thermal_break_unit', 'thermal_bridge'],
    source: 'BCI 7.39, 7.44, building science practice',
    sourceKind: 'mixed',
  }),

  part('balcony_slab', {
    title: 'Balcony slab',
    short: 'A slab that runs from inside to the outdoors.',
    what: 'A concrete slab that continues from the floor inside through the wall to a balcony outside.',
    job: 'It is one continuous piece of concrete, so it works like a cooling fin. It draws heat out of the building in winter.',
    ifWrong: 'The slab pulls heat out and chills the floor edge. Heat loss rises a lot, and the inside surface can fall below the dew point.',
    doThis: 'Use a structural thermal break unit between the inside slab and the balcony. Or support the balcony on its own columns or brackets.',
    products: ['Structural thermal break unit', 'Separate balcony columns', 'Bolted steel balcony'],
    facts: [
      { label: 'Detail in the app', value: 'Slab through the insulation' },
      { label: 'Concrete R per inch', value: '0.08' },
    ],
    mistake: 'Casting the balcony as one piece with the floor slab.',
    are: 'PPD: Know that balconies and other projecting slabs are classic thermal bridges and that a break or separate support fixes them.',
    more: [
      'The balcony is the through-the-wall version of the slab edge detail in this app.',
    ],
    related: ['slab_edge', 'thermal_break_unit', 'thermal_break', 'concrete'],
    source: 'Building science practice',
    sourceKind: 'general',
  }),

  part('shelf_angle', {
    title: 'Shelf angle',
    short: 'A steel angle that holds up the brick at each floor.',
    what: 'A steel angle bolted to the slab edge. The brick veneer sits on its horizontal leg. A filler and sealant joint under it lets the brick grow.',
    job: 'It carries the weight of the brick back to the frame. Flashing and weep holes go above it. Because steel is a great conductor, a continuous angle bridges the insulation.',
    ifWrong: 'A continuous angle runs a steel path through the insulation and the air space. Heat flows out along the steel and the wall near the floor gets cold.',
    doThis: 'Use standoff brackets so the insulation runs past the angle. Flash above it. Keep the compressible joint under it so the frame does not load the brick.',
    products: ['Continuous steel angle', 'Angle on standoff brackets', 'Stainless steel angle'],
    facts: [
      { label: 'Steel thickness in the model', value: '3/8 in.' },
      { label: 'Vertical leg in the model', value: '4 in.' },
      { label: 'Insert boxes', value: '24 in. o.c.' },
    ],
    mistake: 'Running the angle continuously through the insulation without brackets.',
    are: 'PDD: Know that the shelf angle needs flashing above it, weep holes, and a compressible joint below it.',
    more: [
      'In the app, compare the Continuous steel angle with the Angle on standoff brackets. The brackets let the insulation run past.',
    ],
    related: ['standoff_bracket', 'brick', 'flashing', 'thermal_bridge', 'steel'],
    source: 'BCI 7.28, building science practice',
    sourceKind: 'mixed',
  }),

  part('standoff_bracket', {
    title: 'Standoff bracket',
    short: 'A small bracket that holds the angle out from the wall.',
    what: 'A short steel bracket that supports the shelf angle at a distance from the slab. In the model the brackets are 4 in. wide every 48 in.',
    job: 'The brackets touch the wall at only a few spots, so the insulation can run between them. That cuts the steel path to a small share of the length.',
    ifWrong: 'If the brackets are close together or the insulation is cut around them, they bridge again. Large brackets add more steel.',
    doThis: 'Space the brackets as far apart as the design allows. Keep the insulation continuous between them. Use stainless steel to cut the heat flow.',
    products: ['Steel standoff bracket', 'Stainless standoff bracket', 'Fiberglass bracket'],
    facts: [
      { label: 'Width in the model', value: '4 in.' },
      { label: 'Spacing in the model', value: '48 in.' },
    ],
    mistake: 'Cutting the insulation in the way of every bracket.',
    are: 'PDD: Know that standoff brackets are a way to keep insulation continuous behind a shelf angle.',
    more: [
      'The brackets count as one twelfth of the length in the model. The rest of the length is insulation.',
    ],
    related: ['shelf_angle', 'thermal_bridge', 'continuous_insulation', 'steel'],
    source: 'Building science practice',
    sourceKind: 'general',
  }),

  part('thermal_break_unit', {
    title: 'Thermal break unit',
    short: 'A foam block with bars that links slab and balcony.',
    what: 'A structural thermal break is a strip of rigid insulation with steel bars through it. It sits between the inside slab and the balcony slab.',
    job: 'The insulation cuts the heat path through the slab. The bars carry the load across the gap. In the model it is 2 in. thick, in line with the wall insulation.',
    ifWrong: 'If the bars are carbon steel or the break is thin, heat still flows through it. A break out of line with the insulation leaves a bypass.',
    doThis: 'Use a tested unit with stainless bars. Line it up with the wall insulation. Get its tested R-value from the manufacturer.',
    products: ['Structural thermal break connector', 'Insulated edge form'],
    facts: [
      { label: 'Thickness in the model', value: '2 in.' },
      { label: 'Core', value: 'Rigid insulation with stainless bars' },
    ],
    mistake: 'Putting the break in the slab but leaving the wall insulation out of line with it.',
    are: 'PPD: Know that a thermal break unit cuts the bridge at a slab and balcony, and that it is a structural part.',
    more: [
      'The app models the break with about half a percent of the section as steel bars. The bars give back a little of the benefit.',
    ],
    related: ['thermal_break', 'balcony_slab', 'slab_edge', 'thermal_bridge'],
    source: 'Building science practice',
    sourceKind: 'general',
  }),

  part('brick_tie', {
    title: 'Brick tie',
    short: 'A metal tie that holds the brick to the wall behind.',
    what: 'A corrugated or wire metal tie that fastens to the backup wall and sits in a mortar joint of the brick. It crosses the cavity.',
    job: 'It ties the brick back against wind. The brick is not bonded to the backup wall, so the ties are the only link. On stud walls they are no more than 16 in. horizontally and 24 in. vertically.',
    ifWrong: 'Too few ties let the brick move. Ties that slope toward the wall carry water inward. Ties also add small thermal bridges across the cavity.',
    doThis: 'Space the ties as the design requires, and keep them from sloping down toward the backup. Use adjustable ties where joints do not line up. Keep mortar off them.',
    products: ['Corrugated metal tie', 'Adjustable wire tie', 'Stainless tie'],
    facts: [
      { label: 'Spacing on stud walls', value: '16 in. horizontal, 24 in. vertical' },
      { label: 'Spacing on concrete frame', value: 'Wire ties 16 in. o.c. vertically' },
    ],
    mistake: 'Letting ties slope down to the backup wall, which carries water to it.',
    are: 'PDD: Know the tie spacing on stud walls and that veneer is held back by ties, not bonded.',
    more: [
      'Adjustable ties handle bed joints that do not line up with the fixing points on the backup wall.',
    ],
    related: ['brick', 'cavity', 'thermal_bridge', 'rainscreen'],
    source: 'BCI 5.23, 7.28, building science practice',
    sourceKind: 'mixed',
  }),

  // ------------------------------------------------------------------ water parts
  part('head_flashing', {
    title: 'Head flashing',
    short: 'Flashing over a window that catches water from above.',
    what: 'A strip of flashing set above a window or door head. It turns up at its inner end and runs out past the face of the cladding.',
    job: 'Water running down behind the cladding meets the head of the opening. The flashing catches it and drips it to the outside, away from the window.',
    ifWrong: 'Without head flashing, the water runs onto the window head and into the rough opening. It wets the framing and the interior.',
    doThis: 'Turn the flashing up 2 in. at its inner end. Project it 3/4 in. past the face and turn it down 45 degrees to form a drip. Lap the WRB over it.',
    products: ['Sheet metal head flashing', 'Self-adhered membrane flashing', 'Preformed flashing with end dams'],
    facts: [
      { label: 'Turn-up', value: '2 in.' },
      { label: 'Projection past the face', value: '3/4 in.' },
      { label: 'Drip angle', value: '45 degrees' },
    ],
    mistake: 'Leaving out head flashing, or lapping the WRB behind it.',
    are: 'PDD: Know the head flashing numbers: 2 in. turn-up and a 3/4 in. drip past the face, turned down 45 degrees.',
    more: [
      'In a masonry wall the flashing rises across the cavity from the lintel to its turned-up inner end. It also needs weep holes above it.',
    ],
    related: ['flashing', 'drip_edge', 'window_opening', 'lap_joint', 'end_dam'],
    source: 'BCI 7.22, 7.28',
    sourceKind: 'ching',
  }),

  part('sill_pan', {
    title: 'Sill pan',
    short: 'A sloped tray under a window that drains water out.',
    what: 'A flashing tray at the bottom of a window opening. It slopes to the outside and has an upturned edge at the back and at each end.',
    job: 'Water that gets past the window runs down to the sill. The pan collects it and sends it out over the face, so it cannot enter the wall.',
    ifWrong: 'A pan with no end dam lets water run off the ends and into the wall at the jamb. A pan that slopes in sends water inward.',
    doThis: 'Slope the pan to the outside. Turn up an end dam at each end, at least 2 in., and seal the corners. Lap the WRB over the pan.',
    products: ['Formed metal sill pan', 'Self-adhered membrane pan', 'Fluid-applied pan'],
    facts: [
      { label: 'End dam height', value: '2 in. minimum' },
      { label: 'Slope', value: 'Down to the outside' },
    ],
    mistake: 'Leaving the corners of the pan unsealed.',
    are: 'PDD: Know that sill flashing slopes out to shed water, and that end dams stop water running off the ends.',
    more: [
      'The No end dam error in the Water mode shows water running out of the end of a pan and into the wall at the jamb.',
    ],
    related: ['end_dam', 'flashing', 'window_opening', 'lap_joint'],
    source: 'BCI 7.22, building science practice',
    sourceKind: 'mixed',
  }),

  part('end_dam', {
    title: 'End dam',
    short: 'An upturned end that keeps pan water from running off.',
    what: 'An end dam is a turned-up edge at each end of a sill pan or flashing.',
    job: 'It holds water in the pan so it can only leave over the front edge. It keeps water from running off the ends into the wall at the jamb.',
    ifWrong: 'With no end dam, water runs off the end of the pan and into the wall at the jamb.',
    doThis: 'Turn up an end dam at each end, at least 2 in. high. Seal the corners so water cannot pass through them.',
    products: ['Formed metal end dam', 'Preformed membrane end dam'],
    facts: [
      { label: 'Height', value: '2 in. minimum' },
    ],
    mistake: 'Making the end dam too short, or leaving the corner open.',
    are: 'PDD: Know that a sill pan needs end dams of at least 2 in. and that water otherwise runs into the wall at the jamb.',
    more: [
      'Head flashing also needs ends turned up so that water does not run off them.',
    ],
    related: ['sill_pan', 'head_flashing', 'flashing', 'window_opening'],
    source: 'BCI 7.22',
    sourceKind: 'ching',
  }),

  part('base_flashing', {
    title: 'Base flashing',
    short: 'Flashing at the foot of the wall that leads water out.',
    what: 'A strip of flashing at the bottom of the wall or cavity. It sits above finish grade and leads water out through the weep holes.',
    job: 'Water that runs down the cavity lands on the flashing and leaves through the weep holes just above it. It keeps the water off the foundation and the wall base.',
    ifWrong: 'Without base flashing, water soaks the base of the wall. Flashing with no weep holes leaves the water standing on it.',
    doThis: 'Place the flashing above finish grade. Turn it up behind the WRB, with the WRB lapped over it. Put weep holes just above it, 24 in. o.c. in brick.',
    products: ['Sheet metal flashing', 'Self-adhered membrane flashing', 'Flashing with a drip'],
    facts: [
      { label: 'Weep holes above it', value: '24 in. o.c. in brick' },
      { label: 'Position', value: 'Above finish grade' },
    ],
    mistake: 'Burying the flashing below grade, or covering the weep holes.',
    are: 'PDD: Know that base course flashing sits above finish grade and has weep holes just above it.',
    more: [
      'The No weep holes error in the Water mode shows water filling the base of the cavity.',
    ],
    related: ['weep_holes', 'flashing', 'cavity', 'lap_joint'],
    source: 'BCI 7.22, 7.28',
    sourceKind: 'ching',
  }),

  part('drip_edge', {
    title: 'Drip edge',
    short: 'A turned-down edge that makes water fall free.',
    what: 'A drip edge is the lower edge of flashing or a ledge, turned down so water drops off instead of creeping back.',
    job: 'Water clings to the underside of a level surface by surface tension and creeps back to the wall. A drip breaks the film so drops fall free.',
    ifWrong: 'Without a drip, water creeps along the underside and back onto the wall below. It stains the face and enters the joints.',
    doThis: 'Project the flashing 3/4 in. past the wall face and turn it down at 45 degrees. Add a drip groove under sills and ledges.',
    products: ['Metal flashing with a drip', 'Sill with a drip groove', 'Routed drip in foam'],
    facts: [
      { label: 'Projection past the face', value: '3/4 in.' },
      { label: 'Turn-down angle', value: '45 degrees' },
    ],
    mistake: 'Cutting the flashing flush with the wall face.',
    are: 'PDD: Know the force: surface tension. Know the defense: a drip edge that breaks the film.',
    more: [
      'A routed drip in EIFS foam follows the same idea. Water stays off the wall below.',
    ],
    related: ['flashing', 'head_flashing', 'capillary_break', 'rainscreen'],
    source: 'BCI 7.22, 7.23, 7.38',
    sourceKind: 'ching',
  }),

  part('lap_joint', {
    title: 'Lap joint',
    short: 'Layers overlap like shingles, upper over lower.',
    what: 'A lap joint is an overlap between two sheets of WRB or flashing. The upper layer goes over the lower layer.',
    job: 'Gravity pulls water down. If the upper layer laps over the lower, water stays on the outer face and keeps moving down and out.',
    ifWrong: 'A reverse lap tucks the upper layer behind the lower. Water runs behind the lower layer and onto the sheathing.',
    doThis: 'Start at the bottom and work up so every upper layer laps over the lower. Seal the vertical joints. Follow the manufacturer for lap width.',
    products: ['Lapped housewrap', 'Lapped self-adhered membrane', 'Lapped metal flashing'],
    facts: [
      { label: 'Lap in the model', value: '3 in.' },
      { label: 'Rule', value: 'Upper layer over lower' },
    ],
    mistake: 'Reverse lapping, which sends water behind the lower layer.',
    are: 'PDD: Know the force: gravity. Know the defense: lap horizontal joints like shingles and seal the vertical joints.',
    more: [
      'The Reverse lap error in the Water mode shows the wrong order and where the water goes.',
    ],
    related: ['wrb', 'wrb_concept', 'flashing', 'head_flashing'],
    source: 'BCI 7.23',
    sourceKind: 'ching',
  }),

  part('window_opening', {
    title: 'Window opening',
    short: 'The most leak-prone spot in the wall.',
    what: 'The rough opening in the wall where a window goes. It has a head, a sill, and two jambs.',
    job: 'Openings break the continuous WRB and the air barrier. Flashing at the head, the sill pan, and sealed jambs let the opening carry water out instead of in.',
    ifWrong: 'Window and door perimeters are the weak spots in most walls. Missing flashing sends water into the framing and the interior.',
    doThis: 'Flash the head, pan the sill, and seal the jambs. Lap the WRB over each flashing. Fill the gap around the frame with insulation.',
    products: ['Head flashing', 'Sill pan', 'Self-adhered jamb flashing'],
    facts: [
      { label: 'Head flashing turn-up', value: '2 in.' },
      { label: 'Sill pan end dams', value: '2 in. minimum' },
    ],
    mistake: 'Installing the window before the sill pan is in place.',
    are: 'PDD: Know that openings are where leaks start. Know to flash heads, sills, and door thresholds.',
    more: [
      'Windows are also the weakest thermal part of the wall. Frames without a thermal break can fall below the dew point.',
    ],
    related: ['head_flashing', 'sill_pan', 'end_dam', 'flashing', 'lap_joint'],
    source: 'BCI 7.22, 7.38, 7.44, ARE notes: Building envelope',
    sourceKind: 'ching',
  }),

  part('mortar_joint', {
    title: 'Mortar joint',
    short: 'The joint between bricks takes in water.',
    what: 'A mortar joint is the layer of mortar between bricks. It is a weak point in a masonry wall.',
    job: 'Masonry takes in water more than other walls. Well-tooled joints shed water better and cut how much water enters.',
    ifWrong: 'Poorly filled joints and hairline cracks let water in. Water also enters at the joint between brick and window frame.',
    doThis: 'Tool the joints well. Seal joints at window and door frames. Slope sills and copings to shed water.',
    products: ['Portland cement mortar', 'Tooled concave joint'],
    facts: [
      { label: 'Weep holes', value: 'Open head joints above flashing' },
    ],
    mistake: 'Leaving the joints unfinished and trusting the flashing to catch everything.',
    are: 'PDD: Know that masonry takes in water readily and that good workmanship limits it.',
    more: [
      'Open head joints just above the flashing make the weep holes.',
    ],
    related: ['brick', 'weep_holes', 'flashing', 'cavity'],
    source: 'BCI 7.22',
    sourceKind: 'ching',
  }),

  part('cavity', {
    title: 'Cavity',
    short: 'The open gap where water falls and the wall dries.',
    what: 'The open space between the brick and the backup wall. In the Water mode it is 2 in. wide.',
    job: 'Water that gets behind the brick falls through it to the flashing and out the weep holes. It is wide enough that the water cannot wick across it.',
    ifWrong: 'Mortar or insulation that bridges the cavity carries water across to the backup wall. A blocked base leaves water standing.',
    doThis: 'Keep at least 2 in. when insulation is in the cavity. Keep the cavity clear of mortar. Add base flashing and weep holes.',
    products: ['Open air cavity', 'Cavity with a drainage mat', 'Cavity with partial rigid insulation'],
    facts: [
      { label: 'Width in the Water mode', value: '2 in.' },
      { label: 'Minimum with cavity insulation', value: '2 in.' },
      { label: 'Air space R in this app', value: '0.97' },
    ],
    mistake: 'Allowing mortar to fall and fill the base of the cavity.',
    are: 'PDD: Know the cavity widths: 1 in. behind brick veneer on studs, 2 in. net in a cavity wall, and 2 in. open when insulation is present.',
    more: [
      'A cavity wall is considered good at resisting leaks because water that gets past the brick drains instead of soaking the backup wall.',
    ],
    related: ['airspace', 'drainage_gap', 'weep_holes', 'brick_tie', 'rainscreen'],
    source: 'BCI 5.23, 7.22, 7.23, 7.28, 7.44',
    sourceKind: 'ching',
  }),
];

// ---------------------------------------------------------------------------
const ALL = [...LAYERS, ...CONCEPTS, ...PARTS];

/** Every card, keyed by id. */
export const INFO = Object.fromEntries(ALL.map((entry) => [entry.id, entry]));

/** Ids of each kind, in display order. */
export const LAYER_IDS = LAYERS.map((e) => e.id);
export const CONCEPT_IDS = CONCEPTS.map((e) => e.id);
export const PART_IDS = PARTS.map((e) => e.id);

/**
 * Card for an id, or null when there is none.
 * @param {string} id
 */
export function getInfo(id) {
  return Object.prototype.hasOwnProperty.call(INFO, id) ? INFO[id] : null;
}

/** Materials that share a card with others. */
const SHARED = { batt_r13: 'batt', batt_r21: 'batt', batt_r19: 'batt' };

/**
 * Card for a material id from envelope/materials.js.
 * @param {string} materialId
 */
export function infoForMaterial(materialId) {
  if (!Object.prototype.hasOwnProperty.call(MATERIALS, materialId)) return null;
  return getInfo(SHARED[materialId] ?? materialId);
}
