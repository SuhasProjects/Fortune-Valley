/**
 * Offline news-wire scenes. Shocks have a pool per variant (medical `wrist`, auto `windshield`, …);
 * life events have a pool per template (`birthday_gift`, `vet_visit`, …). Within a run a pool is read
 * in a seed-shuffled order without replacement (`occurrence` = how many earlier events of that
 * template/variant the run had), so no scene repeats until the pool is exhausted. `{amount}` is the
 * engine's figure; `{pet}`, `{elder}`, `{peer}`, `{hobby}` come from the household profile so a cat
 * never turns into a dog. Style: second person, past tense, concrete nouns, ≤ 32 words, no "!".
 */
import type { ArchetypeId, HouseholdProfile, ShockFlavour, ShockFlavourInput, ShockKind } from '@/types/domain';
import { hashSeed, makeRng } from '@/engine/rng';
import { SHOCK_VARIANTS } from '@/engine/events';
import { LIFE_EVENT_TEMPLATES, LIFE_TEMPLATE_BY_ID, fillProfile } from '@/engine/lifeEvents';

const fmtUsd = (n: number): string => `$${(Number.isFinite(n) ? Math.round(n) : 0).toLocaleString('en-US')}`;

export interface VariantFlavourRow extends ShockFlavour { variant: string }

/** Shock scenes, two per variant. */
export const FLAVOUR_TABLE: Record<Exclude<ShockKind, 'life'>, readonly VariantFlavourRow[]> = {
  medical: [
    { variant: 'wrist', headline: 'Fall on ice', scene: 'You slipped on a patch of ice outside the building on a weekday morning and broke your wrist. The bill came to {amount}.' },
    { variant: 'wrist', headline: 'Wrist broken on stairs', scene: 'You missed the last step on the back stairs and landed on your hand. The cast and X-rays cost {amount}.' },
    { variant: 'er_night', headline: 'Night in the ER', scene: 'Chest pain after dinner put you in an ambulance and through a night of tests. The hospital billed you {amount} and found nothing lasting.' },
    { variant: 'er_night', headline: 'Fever sends you in', scene: 'A fever that would not break sent you to the emergency room after midnight. Fluids, scans and the overnight bed came to {amount}.' },
    { variant: 'stitches', headline: 'Clinic visit, stitches', scene: 'A kitchen knife slipped while you were cutting bread. The urgent care clinic closed your hand with seven stitches and charged {amount}.' },
    { variant: 'stitches', headline: 'Cut closed at clinic', scene: 'A broken glass opened your palm while you were washing up. The walk-in clinic stitched it and billed {amount}.' },
    { variant: 'dental', headline: 'Cracked molar pulled', scene: 'You cracked a molar on an olive stone at lunch. The dentist pulled it the next morning for {amount}.' },
    { variant: 'dental', headline: 'Root canal done', scene: 'A toothache that kept you up for three nights turned out to need a root canal. The dental bill was {amount}.' },
    { variant: 'flu', headline: 'Flu turns to pneumonia', scene: 'Your week of flu became pneumonia and two visits to the clinic. Antibiotics, chest X-rays and the consultations cost {amount}.' },
    { variant: 'flu', headline: 'Chest infection treated', scene: 'A cough you ignored for a fortnight became a chest infection. The doctor, the inhaler and the follow-up came to {amount}.' },
  ],
  auto: [
    { variant: 'windshield', headline: 'Limb hits windshield', scene: 'High wind brought a tree limb down across the parking lot overnight. It went through your windshield and the repair ran {amount}.' },
    { variant: 'windshield', headline: 'Gravel cracks windshield', scene: 'A truck ahead of you on the highway threw gravel into your windshield. The glass shop replaced it for {amount}.' },
    { variant: 'rear_ended', headline: 'Rear-ended at the light', scene: 'A pickup rolled into the back of your car at a red light on your way to work. The body shop quoted {amount}.' },
    { variant: 'rear_ended', headline: 'Bumper crushed in queue', scene: 'A van misjudged the queue at the roundabout and hit your bumper. Straightening the frame cost {amount}.' },
    { variant: 'transmission', headline: 'Transmission fails', scene: 'Your transmission gave out on the highway ramp and the car was towed to the shop. The repair bill was {amount}.' },
    { variant: 'transmission', headline: 'Gearbox grinds to halt', scene: 'Your gearbox started grinding on the way home and would not shift by the morning. The garage charged {amount}.' },
    { variant: 'brakes', headline: 'Brakes fail inspection', scene: 'Your brakes squealed for a week and failed the inspection. New pads, discs and a caliper came to {amount}.' },
    { variant: 'brakes', headline: 'Brake line leaks', scene: 'A brake line rusted through and your pedal went soft at a junction. The repair and a tow cost {amount}.' },
    { variant: 'flat_tyre', headline: 'Pothole takes two tyres', scene: 'A pothole on the ring road blew out two of your tyres and bent a rim. Replacing them cost {amount}.' },
    { variant: 'flat_tyre', headline: 'Nail ruins a tyre', scene: 'You picked up a roofing nail in the car park and the sidewall split. A new tyre and alignment ran {amount}.' },
  ],
  home: [
    { variant: 'water_heater', headline: 'Water heater quits', scene: 'Your water heater failed overnight and flooded the floor around it. Replacing the unit and drying the room cost you {amount}.' },
    { variant: 'water_heater', headline: 'Boiler gives out', scene: 'Your boiler stopped on the coldest morning of the year. The engineer replaced the heat exchanger for {amount}.' },
    { variant: 'break_in', headline: 'Break-in reported', scene: 'Someone forced your door while you were out on a Tuesday. Your laptop and bike were taken, a loss of {amount}.' },
    { variant: 'break_in', headline: 'Window forced overnight', scene: 'Someone came in through a back window while you slept. Your tablet, headphones and a jar of cash were gone, a loss of {amount}.' },
    { variant: 'burst_pipe', headline: 'Pipe bursts upstairs', scene: 'A pipe in your ceiling burst during a cold snap and soaked the room below. The damage came to {amount}.' },
    { variant: 'burst_pipe', headline: 'Kitchen pipe splits', scene: 'A pipe under your sink split and ran all night. The plumber and the ruined cabinet floor cost {amount}.' },
    { variant: 'fridge', headline: 'Fridge dies in heat', scene: 'Your fridge died during a heatwave and a week of food went with it. The replacement and the spoiled groceries came to {amount}.' },
    { variant: 'fridge', headline: 'Freezer fails overnight', scene: 'Your freezer compressor failed and everything inside thawed by morning. A new unit and the lost food cost {amount}.' },
    { variant: 'window', headline: 'Storm breaks window', scene: 'A storm blew a branch through your bedroom window. Boarding it, the glazier and a new frame came to {amount}.' },
    { variant: 'window', headline: 'Ball shatters pane', scene: 'A stray ball from the street shattered your front window. The emergency glazier charged {amount}.' },
  ],
  job_loss: [
    { variant: 'shift_cut', headline: 'Plant cuts night shift', scene: 'The plant ended its night shift at the start of the month and let the crew go. Your position was among those cut.' },
    { variant: 'shift_cut', headline: 'Weekend shift dropped', scene: 'Your employer dropped the weekend shift to save costs and gave two weeks notice. Your hours ended with it.' },
    { variant: 'department_closed', headline: 'Department closed', scene: 'Management closed your department on a Friday afternoon and gave notice by email. Your pay stopped at the end of the week.' },
    { variant: 'department_closed', headline: 'Branch shuts down', scene: 'Your branch closed after the merger and the roles moved to another city. You were not offered a transfer.' },
    { variant: 'contract_ended', headline: 'Contract not renewed', scene: 'Your contract ran out at month end and the employer did not renew it. Unemployment benefits now replace part of your pay.' },
    { variant: 'contract_ended', headline: 'Project funding ends', scene: 'The project that paid your contract lost its funding. Your last day came at the end of the month.' },
  ],
};

/** A life-event scene; `fit` narrows the row to households it suits (unset = anyone). */
export interface LifeFlavourRow extends ShockFlavour { templateId: string; fit?: 'kids' | 'student' | readonly ArchetypeId[] }

const row = (templateId: string, headline: string, scene: string, fit?: LifeFlavourRow['fit']): LifeFlavourRow => (fit ? { templateId, headline, scene, fit } : { templateId, headline, scene });

/** Life-event scene pools by template id. */
export const LIFE_SCENES: Record<string, readonly LifeFlavourRow[]> = {
  birthday_gift: [
    row('birthday_gift', 'Birthday card holds a cheque', 'Your {elder} mailed a birthday card with a cheque folded inside. You deposited the {amount} on Monday.'),
    row('birthday_gift', 'Birthday money arrives', 'Your {elder} rang on your birthday and sent {amount} by transfer the same afternoon.'),
    row('birthday_gift', 'Birthday envelope at door', 'An envelope from your {elder} was waiting on your birthday. Inside were {amount} and a note about saving some of it.'),
    row('birthday_gift', 'Birthday dinner, then cash', 'Your {elder} took you out for a birthday dinner and slipped you {amount} on the way home.'),
    row('birthday_gift', 'Birthday gift lands early', 'Your {elder} never trusts the post, so the birthday money came a week early. You banked the {amount}.'),
    row('birthday_gift', 'Birthday transfer noted', 'A transfer marked happy birthday showed up from your {elder}. The {amount} cleared before breakfast.'),
    row('birthday_gift', 'Card arrives on the day', 'Your {elder} timed the birthday card to the day, as always. The {amount} inside went into your account.'),
    row('birthday_gift', 'Birthday call brings cheque', 'Your {elder} called to sing down the phone for your birthday. A cheque for {amount} followed in the post.'),
  ],
  holiday_gift: [
    row('holiday_gift', 'Holiday card holds cash', 'Your {elder} sent a holiday card with {amount} tucked inside. You added it to your account the same week.'),
    row('holiday_gift', 'Holiday transfer arrives', 'Your {elder} sent {amount} for the holidays instead of a present this year, with a note to spend it well.'),
    row('holiday_gift', 'Holiday envelope at dinner', 'Over the holiday dinner your {elder} handed round envelopes. Yours held {amount}.'),
    row('holiday_gift', 'Holiday money by post', 'A holiday card from your {elder} arrived with a cheque for {amount} and a long letter.'),
    row('holiday_gift', 'Holiday gift goes to bank', 'Your {elder} gave you {amount} for the holidays and told you not to spend it all at once. You banked it.'),
    row('holiday_gift', 'Stocking holds a cheque', 'At the bottom of the holiday stocking from your {elder} was a cheque for {amount}.'),
    row('holiday_gift', 'Holiday call, then money', 'Your {elder} called on the holiday morning and sent {amount} by transfer while you were still talking.'),
    row('holiday_gift', 'Holiday card with cash', 'The holiday card from your {elder} was heavier than usual. Inside were {amount} in notes.'),
  ],
  tax_refund: [
    row('tax_refund', 'Tax refund arrives', 'The tax office reviewed your return and found you had overpaid. A refund of {amount} arrived by direct deposit.'),
    row('tax_refund', 'Refund lands in April', 'Your tax return was processed faster than expected. The {amount} refund landed in your account this week.'),
    row('tax_refund', 'Overpaid tax returned', 'Your payroll had withheld too much over the year. The tax office refunded {amount}.'),
    row('tax_refund', 'Tax credit paid out', 'A credit you had forgotten to claim last year came through on this return. The refund was {amount}.'),
    row('tax_refund', 'Refund cheque in post', 'The tax office sent your refund by cheque rather than transfer. You deposited the {amount} on Friday.'),
    row('tax_refund', 'Return filed, refund paid', 'You filed your return on time for once and the refund came within three weeks. It was {amount}.'),
    row('tax_refund', 'Tax season pays back', 'Tax season ended with money coming back to you rather than going out. The refund was {amount}.'),
    row('tax_refund', 'Withholding error refunded', 'An error in last year\'s withholding was corrected on your return. The tax office paid back {amount}.'),
  ],
  flight_refund: [
    row('flight_refund', 'Cancelled flight refunded', 'The airline cancelled your morning flight and refunded the fare. You received {amount} back on your card.'),
    row('flight_refund', 'Airline pays compensation', 'Your flight was cancelled the night before and the airline paid compensation. The {amount} reached your card within a week.'),
    row('flight_refund', 'Fare returned after strike', 'A strike grounded your flight and the airline refunded the fare in full. You got {amount} back.'),
    row('flight_refund', 'Refund for missed connection', 'You missed a connection after a delay and the airline refunded the unused leg. The {amount} appeared on your statement.'),
    row('flight_refund', 'Fog cancels flight, refund', 'Fog closed the airport and your flight never left. The airline refunded {amount} to your card.'),
    row('flight_refund', 'Overbooked flight pays out', 'Your flight was overbooked and you took the later one. The airline paid you {amount} for the trouble.'),
  ],
  friend_repays: [
    row('friend_repays', 'Friend repays a loan', 'A friend you had lent money to last year paid you back in full. The {amount} landed in your account by transfer.'),
    row('friend_repays', 'Old loan comes back', 'A friend remembered the money you lent before a move and sent {amount} with an apology for the wait.'),
    row('friend_repays', 'Friend settles up', 'A friend settled the trip costs you had covered months ago. You received {amount} in cash over coffee.'),
    row('friend_repays', 'Loan repaid at last', 'A friend who had owed you since spring paid back {amount} on payday and bought lunch to say thanks.'),
    row('friend_repays', 'Transfer clears old debt', 'A transfer for {amount} arrived from a friend with the note: finally. You had lent it for a deposit.'),
    row('friend_repays', 'Friend pays back dinner', 'A friend paid back the dinners and tickets you had covered over the summer. The {amount} came by transfer.'),
    row('friend_repays', 'Roommate repays bills', 'A former flatmate paid back their share of your final bills. The {amount} arrived without a reminder.'),
    row('friend_repays', 'Friend returns borrowed cash', 'A friend returned the {amount} you lent when their card was frozen. It came in cash in an envelope.'),
    row('friend_repays', 'Repayment arrives by post', 'A friend who moved away sent a cheque for {amount} to clear what they owed you. You banked it.'),
    row('friend_repays', 'Loan paid back early', 'A friend paid you back {amount} two months early after a bonus came through. The transfer cleared overnight.'),
  ],
  expense_claim: [
    row('expense_claim', 'Expense claim paid', 'Your employer finally paid a travel expense claim you had filed months ago. The {amount} reached your account on payday.'),
    row('expense_claim', 'Mileage claim reimbursed', 'Payroll reimbursed the mileage from a client trip you had almost forgotten. The {amount} came with your pay.'),
    row('expense_claim', 'Hotel bill repaid', 'Your employer repaid the hotel you had put on your own card for the conference. You received {amount}.'),
    row('expense_claim', 'Training fee refunded', 'The training course you paid for up front was approved for reimbursement. Your employer paid back {amount}.'),
    row('expense_claim', 'Equipment claim settled', 'Finance approved your claim for the desk lamp and headset you bought for work. The {amount} arrived with payroll.'),
    row('expense_claim', 'Late claim finally paid', 'Your claim that sat in approval for a quarter was paid out at last. The {amount} landed on the first.'),
    row('expense_claim', 'Taxi receipts reimbursed', 'The taxi receipts from the late shifts were reimbursed in one go. Your employer paid {amount}.'),
    row('expense_claim', 'Phone bill repaid', 'Your employer repaid the work calls on your personal phone for the quarter. The {amount} came through payroll.'),
    row('expense_claim', 'Conference costs repaid', 'The conference ticket and train fare you fronted were reimbursed together. You received {amount}.'),
    row('expense_claim', 'Per diem paid late', 'A missed per diem from the site visit was paid after you chased it. The {amount} arrived on payday.'),
  ],
  bursary_topup: [
    row('bursary_topup', 'Bursary top-up paid', 'The student office paid a small bursary top-up it had owed since the autumn. You received {amount}.'),
    row('bursary_topup', 'Hardship fund pays out', 'The hardship fund approved your application after a slow month. The {amount} arrived in your account.'),
    row('bursary_topup', 'Book grant arrives', 'A book grant you applied for in September was finally paid. The {amount} landed on Tuesday.'),
    row('bursary_topup', 'Lab fee refunded', 'The department refunded the lab fee it had charged in error. You got {amount} back.'),
    row('bursary_topup', 'Scholarship adjustment paid', 'Your scholarship was recalculated after a correction to your grades. The difference, {amount}, was paid out.'),
    row('bursary_topup', 'Travel bursary granted', 'The faculty granted a travel bursary for the field course. The {amount} reached your account before the trip.'),
    row('bursary_topup', 'Housing rebate from college', 'The college rebated part of the term\'s housing charge after the heating failed. You received {amount}.'),
    row('bursary_topup', 'Prize money for essay', 'Your essay placed in the department competition. The prize, {amount}, was paid by transfer.'),
    row('bursary_topup', 'Student union refund', 'The student union refunded a society fee after the event was cancelled. The {amount} came back to your card.'),
    row('bursary_topup', 'Tutoring stipend paid', 'The stipend for the peer tutoring you did last term was paid out. You received {amount}.'),
  ],
  childcare_rebate: [
    row('childcare_rebate', 'Childcare rebate paid', 'The council processed a childcare rebate it had held over from last year. You received {amount} by transfer.'),
    row('childcare_rebate', 'Daycare refunds closure', 'The daycare refunded the days it was closed for repairs. The {amount} came back to your account.'),
    row('childcare_rebate', 'After-school fee rebated', 'The after-school club rebated a term\'s fee after an overcharge. You received {amount}.'),
    row('childcare_rebate', 'Child benefit adjustment', 'A child benefit adjustment for last year was paid to you in one lump. It came to {amount}.'),
    row('childcare_rebate', 'Nursery credit refunded', 'The nursery refunded your unused credit from the summer term. The {amount} arrived on Friday.'),
    row('childcare_rebate', 'School meals refunded', 'The school refunded the meal money it charged during the strike days. You got {amount} back.'),
    row('childcare_rebate', 'Camp deposit returned', 'The holiday camp returned your deposit after the week was cancelled. The {amount} came by transfer.'),
    row('childcare_rebate', 'Childcare voucher cashed', 'An unused childcare voucher was cashed out by the provider. The {amount} landed in your account.'),
    row('childcare_rebate', 'Sports club refund', 'Your child\'s sports club refunded the fees for the washed-out season. You received {amount}.'),
    row('childcare_rebate', 'Uniform grant arrives', 'The school uniform grant you applied for was approved. The {amount} came through this week.'),
  ],
  small_gift: [
    row('small_gift', 'Deposit returned', 'Your former landlord returned the cleaning deposit after a final inspection. The {amount} cheque came by post.'),
    row('small_gift', 'Raffle ticket wins', 'Your ticket in the neighbourhood raffle came up second. You collected {amount} at the community hall.'),
    row('small_gift', 'Overcharge refunded', 'Your phone company admitted it had billed you twice in the spring. It credited {amount} back to your account.'),
    row('small_gift', 'Old bike sold', 'You listed the bike that had sat in the hallway for a year. A buyer collected it and paid you {amount} in cash.'),
    row('small_gift', 'Cash in old coat', 'You found {amount} in the pocket of a coat you had not worn since last winter. It went into your account.'),
    row('small_gift', 'Textbooks sold online', 'You sold a shelf of old textbooks to a buyer across town. They paid {amount} in cash.'),
    row('small_gift', 'Utility credit paid back', 'Your energy supplier refunded the credit built up on your account. The {amount} arrived by transfer.'),
    row('small_gift', 'Survey panel pays out', 'The survey panel you joined months ago paid out your points. The {amount} landed on your card.'),
    row('small_gift', 'Furniture sold to neighbour', 'A neighbour bought the bookshelf you no longer had room for. They handed you {amount}.'),
    row('small_gift', 'Insurance premium refunded', 'Your insurer refunded a premium overpayment after a billing review. You received {amount}.'),
    row('small_gift', 'Lost wallet returned', 'A stranger returned the wallet you lost on the bus with the {amount} still inside. You put it straight in the bank.'),
    row('small_gift', 'Gift card cashed out', 'A gift card you could not use was cashed out by the retailer. The {amount} reached your account.'),
  ],
  back_to_school: [
    row('back_to_school', 'Term fees come due', 'The new term brought the registration and lab fees you had put off. You paid {amount} at the student office.', 'student'),
    row('back_to_school', 'Back to school, books', 'Back to school meant a reading list of new editions. The campus store charged you {amount}.', 'student'),
    row('back_to_school', 'Student card and supplies', 'The new term needed a replacement student card, a lab coat and supplies. Your total came to {amount}.', 'student'),
    row('back_to_school', 'Course materials bought', 'Your course posted its materials list the week before term. The kit and printing cost {amount}.', 'student'),
    row('back_to_school', 'Term starts with fees', 'Term started with a sports levy and a technology fee on your account. You paid {amount}.', 'student'),
    row('back_to_school', 'School supplies bought', 'The school sent its back-to-school list and your child needed all of it. The shop total was {amount}.', 'kids'),
    row('back_to_school', 'New uniform for term', 'Your child had grown out of last year\'s uniform. The new set and shoes cost {amount} before term.', 'kids'),
    row('back_to_school', 'School fees due', 'The school billed the activity fee and the trip deposit in the same week. You paid {amount}.', 'kids'),
    row('back_to_school', 'Backpack and books bought', 'Back to school meant a new backpack, workbooks and a calculator for your child. The total was {amount}.', 'kids'),
    row('back_to_school', 'Term starts, fees paid', 'Term started and the school asked for the lunch account and music lessons up front. You paid {amount}.', 'kids'),
  ],
  wedding_gift: [
    row('wedding_gift', 'Wedding gift bought', 'An old friend married in the spring and you were on the guest list. You bought a {amount} gift from the registry.'),
    row('wedding_gift', 'Wedding weekend costs', 'A friend\'s wedding meant a gift and a night in the hotel they had booked. You spent {amount}.'),
    row('wedding_gift', 'Registry gift ordered', 'You ordered the last affordable item on a colleague\'s wedding registry. It cost {amount} with delivery.'),
    row('wedding_gift', 'Cash gift for wedding', 'The couple asked for contributions to their honeymoon instead of gifts. You put {amount} in the envelope.'),
    row('wedding_gift', 'Wedding outfit and gift', 'A family wedding needed a new shirt and a gift from the list. Together they cost you {amount}.'),
    row('wedding_gift', 'Group gift chipped in', 'Friends pooled money for a wedding gift and you paid your share. It was {amount}.'),
  ],
  phone_repair: [
    row('phone_repair', 'Phone screen replaced', 'Your phone slid off the kitchen counter onto the tiles. The repair shop replaced the screen for {amount}.'),
    row('phone_repair', 'Phone dropped on platform', 'Your phone hit the platform face down as the train pulled in. A new screen cost {amount}.'),
    row('phone_repair', 'Cracked screen fixed', 'Your phone cracked in your back pocket when you sat down. The repair came to {amount}.'),
    row('phone_repair', 'Phone survives puddle, barely', 'Your phone went into a puddle and the screen flickered for a week. The repair shop charged {amount}.'),
    row('phone_repair', 'Screen and battery replaced', 'Your phone screen shattered and the battery was failing anyway. Both were replaced for {amount}.'),
    row('phone_repair', 'Phone slips in gym', 'Your phone slipped off the treadmill and landed on the corner. The screen replacement cost {amount}.'),
  ],
  vet_visit: [
    row('vet_visit', 'Vet bill paid', 'Your {pet} came home limping after a scrap in the garden. The vet cleaned the wound and billed you {amount}.'),
    row('vet_visit', 'Ear infection treated', 'Your {pet} would not stop scratching one ear. The vet found an infection and charged {amount} for the visit and drops.'),
    row('vet_visit', 'Vaccinations due', 'Your {pet} was due for annual shots and a check-up. The clinic charged {amount}.'),
    row('vet_visit', 'Pet eats something wrong', 'Your {pet} ate something from the bin and was sick all night. The vet visit and medicine came to {amount}.'),
    row('vet_visit', 'Teeth cleaned at vet', 'The vet said your {pet} needed a dental cleaning under anaesthetic. The bill was {amount}.'),
    row('vet_visit', 'Paw cut on glass', 'Your {pet} cut a paw on broken glass by the bins. Stitches and a bandage cost {amount}.'),
    row('vet_visit', 'Pet stops eating', 'Your {pet} stopped eating for two days and the vet ran blood tests. Nothing serious, but the bill was {amount}.'),
    row('vet_visit', 'Flea treatment bought', 'Your {pet} brought fleas home and the flat needed treating too. The vet and the spray came to {amount}.'),
    row('vet_visit', 'Pet pulls a muscle', 'Your {pet} jumped badly off the sofa and could not put weight on a leg. The vet charged {amount}.'),
    row('vet_visit', 'Vet checks a lump', 'You found a lump on your {pet} and the vet took a sample. It was benign, and the visit cost {amount}.'),
  ],
  parking_ticket: [
    row('parking_ticket', 'Parking ticket issued', 'A warden ticketed your car outside the library on a Saturday afternoon. You paid the {amount} fine before the late fee kicked in.'),
    row('parking_ticket', 'Meter runs out', 'The meter ran out while you queued at the pharmacy. The ticket on your windscreen cost {amount}.'),
    row('parking_ticket', 'Permit bay ticket', 'You parked in a permit bay for ten minutes and a warden was waiting. The fine was {amount}.'),
    row('parking_ticket', 'Camera catches bus lane', 'A camera caught your car in a bus lane on the way to work. The penalty notice was {amount}.'),
    row('parking_ticket', 'Towing fee paid', 'Your car was moved for a street market you did not know about. Getting it back cost {amount}.'),
    row('parking_ticket', 'Speeding notice arrives', 'A speeding notice arrived for the stretch past the school. You paid the {amount} fine online.'),
    row('parking_ticket', 'Ticket for expired disc', 'Your parking disc had expired by twenty minutes when the warden came past. You paid {amount}.'),
    row('parking_ticket', 'Red light camera fine', 'A camera flagged your car crossing on amber at the junction. The fine came to {amount}.'),
    row('parking_ticket', 'Hospital car park fine', 'You overstayed the hospital car park while visiting. The private operator fined you {amount}.'),
    row('parking_ticket', 'Toll notice unpaid', 'You missed a toll on the bypass and the notice arrived with a fee. It cost {amount}.'),
  ],
  commute_cost: [
    row('commute_cost', 'Monthly pass lost', 'You lost your transit pass with three weeks left on it. Replacing it cost {amount}.'),
    row('commute_cost', 'Taxi after last train', 'The last train was cancelled and your only way home was a taxi. The fare was {amount}.'),
    row('commute_cost', 'Fare inspector fines', 'Your pass had expired at midnight and an inspector boarded at the next stop. The penalty fare was {amount}.'),
    row('commute_cost', 'Bike tyre and tube', 'Your bike tyre split on the way in and the tube went with it. The shop charged {amount}.'),
    row('commute_cost', 'Bike lock cut off', 'You lost the key to your bike lock and the shop had to cut it off. A new lock and the labour cost {amount}.'),
    row('commute_cost', 'Strike week fares', 'A transit strike meant a week of shared rides and bus detours. Your extra fares came to {amount}.'),
    row('commute_cost', 'Bike lights stolen', 'Someone took the lights off your bike outside the shop. Replacing them before the dark ride home cost {amount}.'),
    row('commute_cost', 'Ride-share surge pricing', 'A storm shut the line and the ride-share app charged surge prices. Getting you home cost {amount}.'),
    row('commute_cost', 'Rain jacket for commute', 'Your commute jacket finally gave up in a downpour. A new waterproof cost {amount}.'),
    row('commute_cost', 'Bike chain replaced', 'Your bike chain snapped at the lights on the way to work. The repair and a new cassette cost {amount}.'),
  ],
  relative_help: [
    row('relative_help', 'Cousin asks for help', 'Your {peer} called about a short month and a rent gap. You sent {amount} and did not expect it back.'),
    row('relative_help', 'Covering a car repair', 'Your {peer} needed a car repair before a job interview. You covered {amount} of it.'),
    row('relative_help', 'Help with a deposit', 'Your {peer} was short on a flat deposit by the deadline. You transferred {amount} the same evening.'),
    row('relative_help', 'Vet bill for a relative', 'Your {peer} could not cover an emergency vet bill. You sent {amount} to help.'),
    row('relative_help', 'Groceries for a lean week', 'Your {peer} had a lean week after a late paycheque. You paid for the groceries, {amount} in all.'),
    row('relative_help', 'Phone bill covered', 'Your {peer} was about to lose their phone line over an unpaid bill. You paid the {amount}.'),
    row('relative_help', 'Train fare home sent', 'Your {peer} was stranded after a cancelled trip and needed a fare home. You sent {amount}.'),
    row('relative_help', 'Helping with medicine', 'Your {peer} needed a prescription before payday. You covered the {amount}.'),
    row('relative_help', 'Birthday loan to relative', 'Your {peer} asked for help with a surprise for a parent. You chipped in {amount}.'),
    row('relative_help', 'Utility bill covered', 'Your {peer} got a disconnection notice and asked for help. You paid the {amount} bill.'),
  ],
  hobby_cost: [
    row('hobby_cost', 'Worn gear replaced', 'Your {hobby} gear had worn through after a year of use. Replacing it cost {amount}.'),
    row('hobby_cost', 'Club fee comes due', 'The {hobby} club you joined sent its annual fee notice. You paid {amount} to stay a member.'),
    row('hobby_cost', 'Weekend event entry', 'You signed up for a weekend {hobby} event two towns over. Entry and the trip cost {amount}.'),
    row('hobby_cost', 'Kit repaired at shop', 'A piece of your {hobby} kit broke mid-week and the shop fixed it. The repair was {amount}.'),
    row('hobby_cost', 'Lesson block paid', 'You booked a block of {hobby} lessons to get past a plateau. It cost {amount}.'),
    row('hobby_cost', 'Gear lost on trip', 'You left part of your {hobby} gear behind on a trip and had to replace it. The bill was {amount}.'),
    row('hobby_cost', 'Upgrade finally bought', 'The {hobby} upgrade you had been putting off went on sale and you bought it. You paid {amount}.'),
    row('hobby_cost', 'Subscription renews', 'Your {hobby} subscription renewed for the year before you could cancel. It charged {amount}.'),
    row('hobby_cost', 'Accessories wear out', 'Your small {hobby} accessories wore out all at once this month. Replacing them cost {amount}.'),
    row('hobby_cost', 'Workshop weekend booked', 'A {hobby} workshop came to town for one weekend and you went. The ticket was {amount}.'),
  ],
  kid_cost: [
    row('kid_cost', 'School trip fee', 'Your child\'s class booked a trip to the science museum. The school asked for {amount} by the end of the week.'),
    row('kid_cost', 'Daycare bills a late pickup', 'You arrived at daycare twenty minutes late after a train delay. The centre added a {amount} late-pickup charge.'),
    row('kid_cost', 'Shoes outgrown again', 'Your child outgrew their school shoes for the second time this year. The new pair cost {amount}.'),
    row('kid_cost', 'Birthday party costs', 'Your child was invited to three birthday parties in one month. Gifts and a party of their own came to {amount}.'),
    row('kid_cost', 'Dentist for your child', 'Your child\'s check-up turned up a filling. The dentist charged {amount}.'),
    row('kid_cost', 'School photos ordered', 'The school photos arrived and your child wanted the full pack. You paid {amount}.'),
    row('kid_cost', 'Winter coat for child', 'Your child\'s winter coat no longer closed. A new one cost {amount} before the cold set in.'),
    row('kid_cost', 'Swimming lessons paid', 'The new block of swimming lessons for your child came due. It cost {amount}.'),
    row('kid_cost', 'Lost library books', 'Your child lost two library books and the school billed for them. You paid {amount}.'),
    row('kid_cost', 'Sick day childcare', 'Your child was sent home sick and you paid for emergency childcare for two days. It came to {amount}.'),
  ],
  student_cost: [
    row('student_cost', 'Field trip fee due', 'Your course scheduled a two-day field trip and billed every student. You paid the {amount} fee at the registrar.'),
    row('student_cost', 'Textbook replaced', 'Your chemistry textbook went missing from the study hall. The campus store charged you {amount} for a new copy.'),
    row('student_cost', 'Printing credit topped up', 'Your dissertation drafts emptied the printing account twice. Topping it up cost {amount}.'),
    row('student_cost', 'Exam resit fee', 'You had to resit one exam and the department charged a fee. It was {amount}.'),
    row('student_cost', 'Lab goggles and coat', 'The lab required new goggles and a coat before practicals could start. You paid {amount}.'),
    row('student_cost', 'Library fine paid', 'Three overdue books added up over the holidays. Your library fine came to {amount}.'),
    row('student_cost', 'Software licence bought', 'Your course required a software licence the campus did not cover. It cost {amount}.'),
    row('student_cost', 'Society trip paid', 'Your society organised a weekend trip and you signed up. The cost was {amount}.'),
    row('student_cost', 'Dorm key replaced', 'You lost your dorm key and the housing office replaced the lock. The charge was {amount}.'),
    row('student_cost', 'Graduation gown deposit', 'The gown hire and photo deposit for graduation came due early. You paid {amount}.'),
  ],
  small_cost: [
    row('small_cost', 'Dentist charges extra', 'A routine cleaning turned up a cracked filling. Your dentist replaced it and charged {amount} the same day.'),
    row('small_cost', 'Late fee charged', 'You missed a utility due date by three days while travelling. The late fee came to {amount}.'),
    row('small_cost', 'Office collection comes round', 'A colleague retired after thirty years and the office passed the envelope. You put in {amount}.'),
    row('small_cost', 'Concert ticket bought', 'The band you had followed since school came through town for one night. The ticket cost you {amount}.'),
    row('small_cost', 'Keys lost, locks changed', 'You lost your keys on a night out and had the lock changed. The locksmith charged {amount}.'),
    row('small_cost', 'Glasses repaired', 'You sat on your glasses and the frame snapped. The optician repaired them for {amount}.'),
    row('small_cost', 'Prescription not covered', 'A prescription turned out not to be covered by your plan. You paid {amount} at the pharmacy.'),
    row('small_cost', 'Washing machine call-out', 'Your washing machine stopped mid-cycle and the engineer charged a call-out fee. It cost {amount}.'),
    row('small_cost', 'Funeral flowers sent', 'A neighbour passed away and you sent flowers to the family. They cost {amount}.'),
    row('small_cost', 'Overdraft fee hits', 'A payment went out a day before your pay came in and the bank charged a fee. It was {amount}.'),
    row('small_cost', 'Umbrella and dry cleaning', 'A downpour ruined your coat and you bought an umbrella too late. Cleaning and the umbrella cost {amount}.'),
    row('small_cost', 'Passport renewal fee', 'Your passport expired a month before a trip and the renewal came with a fee. You paid {amount}.'),
  ],
};

/** All life rows, flat (kept for the lint tests and any caller that wants a sign-wide view). */
export const LIFE_COST_TABLE: readonly LifeFlavourRow[] = LIFE_EVENT_TEMPLATES.filter((t) => t.sign === -1).flatMap((t) => LIFE_SCENES[t.id] ?? []);
export const LIFE_GIFT_TABLE: readonly LifeFlavourRow[] = LIFE_EVENT_TEMPLATES.filter((t) => t.sign === 1).flatMap((t) => LIFE_SCENES[t.id] ?? []);

const rowFits = (r: LifeFlavourRow, profile: HouseholdProfile | undefined, archetype: ArchetypeId | undefined): boolean => {
  if (!r.fit) return true;
  const a = profile?.archetype ?? archetype;
  if (r.fit === 'kids') return profile ? profile.hasKids : a === 'young_family';
  if (r.fit === 'student') return a === 'college_student';
  return a !== undefined && r.fit.includes(a);
};

/** Life-event rows that fit the household: the template's pool when `templateId` is known, else every row of that sign. */
export function lifeRows(amount: number, archetype?: ArchetypeId, templateId?: string, profile?: HouseholdProfile): readonly LifeFlavourRow[] {
  const pool = templateId && LIFE_SCENES[templateId] ? LIFE_SCENES[templateId]! : amount >= 0 ? LIFE_GIFT_TABLE : LIFE_COST_TABLE;
  const fitted = pool.filter((r) => rowFits(r, profile, archetype));
  return fitted.length > 0 ? fitted : pool;
}

/** Deterministic permutation of `n` indices for (runSeed, key): the run's reading order for a pool. */
export function shuffledOrder(n: number, runSeed: number | string, key: string): number[] {
  const rng = makeRng(hashSeed(runSeed, 'scene-order', key));
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }
  return idx;
}

/** Fill `{amount}` and the profile slots. */
function render<T extends ShockFlavour>(r: T, amount: number, profile: HouseholdProfile | undefined): ShockFlavour {
  return { headline: fillProfile(r.headline, profile), scene: fillProfile(r.scene, profile).replace('{amount}', fmtUsd(Math.abs(amount))) };
}

/**
 * Deterministic table pick; `seed` is usually the notification id. With `templateId`/`variant` plus
 * `occurrence` and `runSeed` the pick walks a seed-shuffled pool without replacement, so a run never
 * shows the same scene twice until the pool is used up. Without them it falls back to a hash pick.
 */
export function pickFlavour(input: ShockFlavourInput, seed: number | string): ShockFlavour {
  const runSeed = input.runSeed ?? seed;
  if (input.kind === 'life') {
    const rows = lifeRows(input.amount, input.archetype, input.templateId, input.household);
    const key = input.templateId ?? (input.amount >= 0 ? 'gift' : 'cost');
    const i = input.occurrence !== undefined && input.templateId
      ? shuffledOrder(rows.length, runSeed, key)[input.occurrence % rows.length]!
      : hashSeed(seed, input.kind, input.monthLabel, input.amount >= 0 ? 'gift' : 'cost') % rows.length;
    return render(rows[i]!, input.amount, input.household);
  }
  const all = FLAVOUR_TABLE[input.kind];
  const variant = input.variant && SHOCK_VARIANTS[input.kind].includes(input.variant) ? input.variant : undefined;
  const rows = variant ? all.filter((r) => r.variant === variant) : all;
  const i = variant && input.occurrence !== undefined
    ? shuffledOrder(rows.length, runSeed, `${input.kind}:${variant}`)[input.occurrence % rows.length]!
    : hashSeed(seed, input.kind, input.monthLabel) % rows.length;
  return render(rows[i]!, input.amount, input.household);
}

export { LIFE_TEMPLATE_BY_ID };
