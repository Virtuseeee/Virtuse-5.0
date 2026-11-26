// Synthetic broker exports used by "use sample file" and by the tests.
// Not real accounts. Formats follow each broker's documented export.
import bank from './samples/bank-statement.csv?raw'
import ibkr from './samples/ibkr-activity.csv?raw'
import t212 from './samples/t212-history.csv?raw'
import xtbCash from './samples/xtb-cash-operations.csv?raw'
import xtbPositions from './samples/xtb-open-positions.csv?raw'

export const SAMPLES = { bank, ibkr, t212, xtbCash, xtbPositions }
