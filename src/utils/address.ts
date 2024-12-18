import { Helpers } from './helpers';
import { NumberGenerator } from './number';
import { StringGenerator } from './strings';
import { EN_DIRECTIONS } from '../data/en-directions.data';
import { EN_SECONDARY_DESCRIPTOR } from '../data/en-secondary-descriptors';
import { EN_STREET_DESCRIPTORS } from '../data/en-street-descriptors.data';
import { EN_STREET_NAMES } from '../data/en-street-names.data';
import { EN_US_STATES } from '../data/en-us-states.data';
import {
    AddressItem,
    DataCity,
    DataDirectionsMap,
    DataSecondaryDescriptor,
    DataSecondaryDescriptorMap,
    DataSecondaryDescriptorType,
    DataState,
    DataStateMap,
    DataStreetDescriptorMap,
    DataStreetDescriptorType,
    DataStreetNames,
    PatternPrimaryStreetKey,
} from '../interfaces/address.interface';
import { Resolvers } from '../interfaces/general.interface';
import { EN_STREET_PATTERNS } from '../patterns/en-street.pattern';

const h = Helpers;
const num = NumberGenerator;
const str = StringGenerator;

/**
 * A utility for generating addresses.
 */
export class Address {
    private static dataStates: DataStateMap = EN_US_STATES;
    private static dataDirections: DataDirectionsMap = EN_DIRECTIONS;

    private static dataStreetPatterns = EN_STREET_PATTERNS;
    private static dataStreetNames: DataStreetNames = EN_STREET_NAMES;
    private static dataStreetDescriptors: DataStreetDescriptorMap =
        EN_STREET_DESCRIPTORS;

    private static dataSecondaryDescriptors: DataSecondaryDescriptorMap =
        EN_SECONDARY_DESCRIPTOR;

    private static streetResolvers: Resolvers<PatternPrimaryStreetKey> = {
        ord: () => num.randomOrdinalInRange(1, 50),
        street: () => h.sample(this.dataStreetNames),
        descriptor: () =>
            h.sample(
                this.dataStreetDescriptors[
                    h.chance<DataStreetDescriptorType>([
                        { val: 'general', prob: 1 / 3 },
                        { val: 'size', prob: 1 / 3 },
                        { val: 'function', prob: 1 / 3 },
                    ])
                ],
            )[h.chance<'abbreviation' | 'name'>('abbreviation', 'name', 0.5)],
        dir: () =>
            this.direction({
                excludeIntercardinals: false,
                abbreviated: h.chance<boolean>(true, false, 0.5),
            }),
    };

    /**
     * Generates a random cardinal or intercardinal direction.
     *
     * @param options - Configuration options for the direction generation.
     * @param options.excludeIntercardinals - If `true`, excludes intercardinal directions
     *                                        and only returns cardinal directions
     * @param options.abbreviated - If `true`, returns abbreviated forms.
     * @returns A random direction as a string, based on the provided options.
     */
    static direction(
        options: {
            excludeIntercardinals?: boolean;
            abbreviated?: boolean;
        } = {},
    ): string {
        const { excludeIntercardinals, abbreviated } = options;
        const i = num.randomInRange(0, excludeIntercardinals ? 3 : 7);
        let dir;

        if (i > 3) {
            // Intercardinals
            dir = this.dataDirections.intercardinal[i % 4];
        } else {
            // Cardinals
            dir = this.dataDirections.cardinal[i];
        }

        return abbreviated ? dir.abbreviation : dir.name;
    }

    /**
     * Generates a random street address (line 1).
     *
     * @param options - Optional configuration for the street address.
     * @param options.includeStreetNumber - Whether to include a random street number.
     * @returns A randomly generated street address with or without a street number.
     */
    static street1(options?: { includeStreetNumber?: boolean }): string {
        const streetNumber = options?.includeStreetNumber
            ? num.randomWithDigits(num.randomInRange(3, 5)) + ' '
            : '';
        const pattern = h.sample(this.dataStreetPatterns);
        return `${streetNumber}${h.interpolate(pattern, this.streetResolvers)}`;
    }

    /**
     * Generates a secondary street address.
     *
     * @param type - Optional configuration to have a `'residential'` type
     *               address or a `'commercial'` type. The difference lies in
     *               the descriptor use (e.g., `'Apt.'` vs. `'Dept.'`)
     * @returns A randomly generated secondary address.
     */
    static street2(type?: DataSecondaryDescriptorType): string {
        const descriptorType =
            type ||
            h.chance<DataSecondaryDescriptorType>(
                'residential',
                'commercial',
                0.5,
            );
        const descriptor = h.sample<DataSecondaryDescriptor>(
            this.dataSecondaryDescriptors[descriptorType],
        );
        const identifier = `${num.randomWithDigits(num.randomInRange(1, 2))}${str.upper()}`;
        return `${descriptor} ${identifier}`;
    }

    /**
     * @param state - Optional configuration to return a city name within the
     *                state (supports both the abbrevation and the full name)
     * @param atFailure - When set to `'error'`, the method will fail if the
     *                    specified state is not a known state by the class.
     *                    When set to `'random'`, which is the default, it
     *                    selects any other random state instead
     * @returns A random city name.
     */
    static city(state?: string, atFailure: 'error' | 'random' = 'random') {
        let stateObj: DataState | undefined;
        if (state && state in this.dataStates) {
            stateObj = this.dataStates[state];
        } else {
            stateObj = Object.entries(this.dataStates).find(
                ([_, o]) => o.name === state,
            )?.[1];
            if (!stateObj) {
                if (atFailure === 'error') {
                    throw new Error(
                        `Specified state "${state}" is not available.`,
                    );
                } else {
                    stateObj =
                        this.dataStates[this.state({ abbreviated: true })];
                }
            }
        }
        return h.sample(stateObj.cities).city;
    }

    /**
     * @returns A random county name.
     */
    static county() {
        return h.sample(
            this.dataStates[this.state({ abbreviated: true })].cities,
        ).county;
    }

    /**
     * Generates a random state name.
     *
     * @param options - Optional configuration for the state name.
     * @param option.abbreviated - Whether to return the state name in abbreviated form.
     * @returns A random state name, abbreviated or full.
     */
    static state(options: { abbreviated?: boolean } = {}) {
        const { abbreviated } = options;
        const stateCode = h.sample(Object.keys(this.dataStates));
        return abbreviated ? stateCode : this.dataStates[stateCode].name;
    }

    /**
     * Generates a ZIP code based on the provided prefix and options.
     *
     * @param options - Configuration for the ZIP code.
     * @param options.prefix - The initial portion of the ZIP code. Should be no
     *                         longer than 9 digits.
     * @param options.nineDigitZip - If `true`, ensures a 9-digit ZIP code is generated.
     * @param options.noDashInZip - If `true`, omits the dash in the nine-digit
     *                              ZIP code (e.g., `"900011234"`). Only applicable
     *                              when `nineDigitZip` is `true`.
     * @returns A randomly generated ZIP code string, either in the 5-digit or 9-digit format.
     */
    static zip(
        options: {
            prefix?: string;
            nineDigitZip?: boolean;
            noDashInZip?: boolean;
        } = {},
    ): string {
        const { prefix = '', nineDigitZip, noDashInZip } = options;
        const sanitizedPrefix = prefix.replace(/-/g, '');

        let base = sanitizedPrefix.slice(0, 5);
        let remainder = sanitizedPrefix.slice(5, 9);

        if (base.length < 5) {
            base += num.randomWithDigits(5 - base.length);
        }

        if (nineDigitZip) {
            if (remainder.length < 4) {
                remainder += num.randomWithDigits(4 - remainder.length);
            }
            return `${base}${noDashInZip ? '' : '-'}${remainder}`;
        }

        return base;
    }

    /**
     * Generates a full address object, including street, city, state, county, ZIP code, and country.
     *
     * @param options - Optional configuration for generating the address.
     * @param options.stateAbbreviated - If `true`, the state will be abbreviated
     *                                   (e.g., "CA" instead of "California").
     * @param options.nineDigitZip - If `true`, generates a nine-digit ZIP code
     *                               (e.g., "12345-6789").
     * @param options.noDashInZip - If `true`, removes the dash in the nine-digit
     *                              ZIP code (only applies if `nineDigitZip` is `true`).
     * @returns An object containing the full address details.
     */
    static full(
        options: {
            stateAbbreviated?: boolean;
            nineDigitZip?: boolean;
            noDashInZip?: boolean;
        } = {},
    ): AddressItem {
        const stateObj: DataState =
            this.dataStates[this.state({ abbreviated: true })];
        const { name: stateName, abbreviation: stateAbbrev, cities } = stateObj;

        const cityObj = h.sample<DataCity>(cities);
        const { city, county, zipCodePrefix } = cityObj;
        const zip = this.zip({ ...options, prefix: zipCodePrefix });

        return {
            street1: this.street1({ includeStreetNumber: true }),
            street2: this.street2(),
            city: city,
            county: county,
            state: options?.stateAbbreviated ? stateAbbrev : stateName,
            zip: zip,
            country: 'US',
        };
    }
}
