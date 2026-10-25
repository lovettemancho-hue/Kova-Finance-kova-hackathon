import {
  convertCurrency,
  fetchLiveExchangeRates,
  subscribeToRates,
  getActiveRates,
  STATIC_USD_RATES,
} from './exchange';

export {
  convertCurrency,
  fetchLiveExchangeRates,
  subscribeToRates,
  getActiveRates,
  STATIC_USD_RATES,
};

export interface CountryCurrencyOption {
  countryName: string;
  countryCode: string;
  currencyCode: string;
  currencyName: string;
  symbol: string;
  flag: string;
}

/**
 * Complete Worldwide ISO 3166 Country List mapped to ISO 4217 Currency Codes.
 * Includes all sovereign nations and major territories.
 */
export const SUPPORTED_COUNTRIES: CountryCurrencyOption[] = [
  { countryName: 'Afghanistan', countryCode: 'AF', currencyCode: 'AFN', currencyName: 'Afghan Afghani', symbol: '؋', flag: '🇦🇫' },
  { countryName: 'Albania', countryCode: 'AL', currencyCode: 'ALL', currencyName: 'Albanian Lek', symbol: 'L', flag: '🇦🇱' },
  { countryName: 'Algeria', countryCode: 'DZ', currencyCode: 'DZD', currencyName: 'Algerian Dinar', symbol: 'د.ج', flag: '🇩🇿' },
  { countryName: 'Andorra', countryCode: 'AD', currencyCode: 'EUR', currencyName: 'Euro', symbol: '€', flag: '🇦🇩' },
  { countryName: 'Angola', countryCode: 'AO', currencyCode: 'AOA', currencyName: 'Angolan Kwanza', symbol: 'Kz', flag: '🇦🇴' },
  { countryName: 'Antigua and Barbuda', countryCode: 'AG', currencyCode: 'XCD', currencyName: 'East Caribbean Dollar', symbol: 'EC$', flag: '🇦🇬' },
  { countryName: 'Argentina', countryCode: 'AR', currencyCode: 'ARS', currencyName: 'Argentine Peso', symbol: 'ARS$', flag: '🇦🇷' },
  { countryName: 'Armenia', countryCode: 'AM', currencyCode: 'AMD', currencyName: 'Armenian Dram', symbol: '֏', flag: '🇦🇲' },
  { countryName: 'Australia', countryCode: 'AU', currencyCode: 'AUD', currencyName: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
  { countryName: 'Austria', countryCode: 'AT', currencyCode: 'EUR', currencyName: 'Euro', symbol: '€', flag: '🇦🇹' },
  { countryName: 'Azerbaijan', countryCode: 'AZ', currencyCode: 'AZN', currencyName: 'Azerbaijani Manat', symbol: '₼', flag: '🇦🇿' },
  { countryName: 'Bahamas', countryCode: 'BS', currencyCode: 'BSD', currencyName: 'Bahamian Dollar', symbol: 'B$', flag: '🇧🇸' },
  { countryName: 'Bahrain', countryCode: 'BH', currencyCode: 'BHD', currencyName: 'Bahraini Dinar', symbol: 'BD', flag: '🇧🇭' },
  { countryName: 'Bangladesh', countryCode: 'BD', currencyCode: 'BDT', currencyName: 'Bangladeshi Taka', symbol: '৳', flag: '🇧🇩' },
  { countryName: 'Barbados', countryCode: 'BB', currencyCode: 'BBD', currencyName: 'Barbadian Dollar', symbol: 'Bds$', flag: '🇧🇧' },
  { countryName: 'Belarus', countryCode: 'BY', currencyCode: 'BYN', currencyName: 'Belarusian Ruble', symbol: 'Br', flag: '🇧🇾' },
  { countryName: 'Belgium', countryCode: 'BE', currencyCode: 'EUR', currencyName: 'Euro', symbol: '€', flag: '🇧🇪' },
  { countryName: 'Belize', countryCode: 'BZ', currencyCode: 'BZD', currencyName: 'Belize Dollar', symbol: 'BZ$', flag: '🇧🇿' },
  { countryName: 'Benin', countryCode: 'BJ', currencyCode: 'XOF', currencyName: 'West African CFA Franc', symbol: 'CFA', flag: '🇧🇯' },
  { countryName: 'Bermuda', countryCode: 'BM', currencyCode: 'BMD', currencyName: 'Bermudian Dollar', symbol: '$', flag: '🇧🇲' },
  { countryName: 'Bhutan', countryCode: 'BT', currencyCode: 'BTN', currencyName: 'Bhutanese Ngultrum', symbol: 'Nu.', flag: '🇧🇹' },
  { countryName: 'Bolivia', countryCode: 'BO', currencyCode: 'BOB', currencyName: 'Bolivian Boliviano', symbol: 'Bs.', flag: '🇧🇴' },
  { countryName: 'Bosnia and Herzegovina', countryCode: 'BA', currencyCode: 'BAM', currencyName: 'Bosnia-Herzegovina Convertible Mark', symbol: 'KM', flag: '🇧🇦' },
  { countryName: 'Botswana', countryCode: 'BW', currencyCode: 'BWP', currencyName: 'Botswanan Pula', symbol: 'P', flag: '🇧🇼' },
  { countryName: 'Brazil', countryCode: 'BR', currencyCode: 'BRL', currencyName: 'Brazilian Real', symbol: 'R$', flag: '🇧🇷' },
  { countryName: 'Brunei', countryCode: 'BN', currencyCode: 'BND', currencyName: 'Brunei Dollar', symbol: 'B$', flag: '🇧🇳' },
  { countryName: 'Bulgaria', countryCode: 'BG', currencyCode: 'BGN', currencyName: 'Bulgarian Lev', symbol: 'лв', flag: '🇧🇬' },
  { countryName: 'Burkina Faso', countryCode: 'BF', currencyCode: 'XOF', currencyName: 'West African CFA Franc', symbol: 'CFA', flag: '🇧🇫' },
  { countryName: 'Burundi', countryCode: 'BI', currencyCode: 'BIF', currencyName: 'Burundian Franc', symbol: 'FBu', flag: '🇧🇮' },
  { countryName: 'Cabo Verde', countryCode: 'CV', currencyCode: 'CVE', currencyName: 'Cape Verdean Escudo', symbol: 'Esc', flag: '🇨🇻' },
  { countryName: 'Cambodia', countryCode: 'KH', currencyCode: 'KHR', currencyName: 'Cambodian Riel', symbol: '៛', flag: '🇰🇭' },
  { countryName: 'Cameroon', countryCode: 'CM', currencyCode: 'XAF', currencyName: 'Central African CFA Franc', symbol: 'FCFA', flag: '🇨🇲' },
  { countryName: 'Canada', countryCode: 'CA', currencyCode: 'CAD', currencyName: 'Canadian Dollar', symbol: 'CA$', flag: '🇨🇦' },
  { countryName: 'Cayman Islands', countryCode: 'KY', currencyCode: 'KYD', currencyName: 'Cayman Islands Dollar', symbol: 'CI$', flag: '🇰🇾' },
  { countryName: 'Central African Republic', countryCode: 'CF', currencyCode: 'XAF', currencyName: 'Central African CFA Franc', symbol: 'FCFA', flag: '🇨🇫' },
  { countryName: 'Chad', countryCode: 'TD', currencyCode: 'XAF', currencyName: 'Central African CFA Franc', symbol: 'FCFA', flag: '🇹🇩' },
  { countryName: 'Chile', countryCode: 'CL', currencyCode: 'CLP', currencyName: 'Chilean Peso', symbol: 'CLP$', flag: '🇨🇱' },
  { countryName: 'China', countryCode: 'CN', currencyCode: 'CNY', currencyName: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳' },
  { countryName: 'Colombia', countryCode: 'CO', currencyCode: 'COP', currencyName: 'Colombian Peso', symbol: 'COL$', flag: '🇨🇴' },
  { countryName: 'Comoros', countryCode: 'KM', currencyCode: 'KMF', currencyName: 'Comorian Franc', symbol: 'CF', flag: '🇰🇲' },
  { countryName: 'Congo (Republic of the)', countryCode: 'CG', currencyCode: 'XAF', currencyName: 'Central African CFA Franc', symbol: 'FCFA', flag: '🇨🇬' },
  { countryName: 'Congo (Democratic Republic of the)', countryCode: 'CD', currencyCode: 'CDF', currencyName: 'Congolese Franc', symbol: 'FC', flag: '🇨🇩' },
  { countryName: 'Costa Rica', countryCode: 'CR', currencyCode: 'CRC', currencyName: 'Costa Rican Colón', symbol: '₡', flag: '🇨🇷' },
  { countryName: 'Croatia', countryCode: 'HR', currencyCode: 'EUR', currencyName: 'Euro', symbol: '€', flag: '🇭🇷' },
  { countryName: 'Cuba', countryCode: 'CU', currencyCode: 'CUP', currencyName: 'Cuban Peso', symbol: '₱', flag: '🇨🇺' },
  { countryName: 'Cyprus', countryCode: 'CY', currencyCode: 'EUR', currencyName: 'Euro', symbol: '€', flag: '🇨🇾' },
  { countryName: 'Czech Republic', countryCode: 'CZ', currencyCode: 'CZK', currencyName: 'Czech Koruna', symbol: 'Kč', flag: '🇨🇿' },
  { countryName: 'Denmark', countryCode: 'DK', currencyCode: 'DKK', currencyName: 'Danish Krone', symbol: 'kr', flag: '🇩🇰' },
  { countryName: 'Djibouti', countryCode: 'DJ', currencyCode: 'DJF', currencyName: 'Djiboutian Franc', symbol: 'Fdj', flag: '🇩🇯' },
  { countryName: 'Dominica', countryCode: 'DM', currencyCode: 'XCD', currencyName: 'East Caribbean Dollar', symbol: 'EC$', flag: '🇩🇲' },
  { countryName: 'Dominican Republic', countryCode: 'DO', currencyCode: 'DOP', currencyName: 'Dominican Peso', symbol: 'RD$', flag: '🇩🇴' },
  { countryName: 'Ecuador', countryCode: 'EC', currencyCode: 'USD', currencyName: 'US Dollar', symbol: '$', flag: '🇪🇨' },
  { countryName: 'Egypt', countryCode: 'EG', currencyCode: 'EGP', currencyName: 'Egyptian Pound', symbol: 'E£', flag: '🇪🇬' },
  { countryName: 'El Salvador', countryCode: 'SV', currencyCode: 'USD', currencyName: 'US Dollar', symbol: '$', flag: '🇸🇻' },
  { countryName: 'Equatorial Guinea', countryCode: 'GQ', currencyCode: 'XAF', currencyName: 'Central African CFA Franc', symbol: 'FCFA', flag: '🇬🇶' },
  { countryName: 'Eritrea', countryCode: 'ER', currencyCode: 'ERN', currencyName: 'Eritrean Nakfa', symbol: 'Nfk', flag: '🇪🇷' },
  { countryName: 'Estonia', countryCode: 'EE', currencyCode: 'EUR', currencyName: 'Euro', symbol: '€', flag: '🇪🇪' },
  { countryName: 'Eswatini', countryCode: 'SZ', currencyCode: 'SZL', currencyName: 'Swazi Lilangeni', symbol: 'E', flag: '🇸🇿' },
  { countryName: 'Ethiopia', countryCode: 'ET', currencyCode: 'ETB', currencyName: 'Ethiopian Birr', symbol: 'Br', flag: '🇪🇹' },
  { countryName: 'European Union (Eurozone)', countryCode: 'EU', currencyCode: 'EUR', currencyName: 'Euro', symbol: '€', flag: '🇪🇺' },
  { countryName: 'Fiji', countryCode: 'FJ', currencyCode: 'FJD', currencyName: 'Fijian Dollar', symbol: 'FJ$', flag: '🇫🇯' },
  { countryName: 'Finland', countryCode: 'FI', currencyCode: 'EUR', currencyName: 'Euro', symbol: '€', flag: '🇫🇮' },
  { countryName: 'France', countryCode: 'FR', currencyCode: 'EUR', currencyName: 'Euro', symbol: '€', flag: '🇫🇷' },
  { countryName: 'Gabon', countryCode: 'GA', currencyCode: 'XAF', currencyName: 'Central African CFA Franc', symbol: 'FCFA', flag: '🇬🇦' },
  { countryName: 'Gambia', countryCode: 'GM', currencyCode: 'GMD', currencyName: 'Gambian Dalasi', symbol: 'D', flag: '🇬🇲' },
  { countryName: 'Georgia', countryCode: 'GE', currencyCode: 'GEL', currencyName: 'Georgian Lari', symbol: '₾', flag: '🇬🇪' },
  { countryName: 'Germany', countryCode: 'DE', currencyCode: 'EUR', currencyName: 'Euro', symbol: '€', flag: '🇩🇪' },
  { countryName: 'Ghana', countryCode: 'GH', currencyCode: 'GHS', currencyName: 'Ghanaian Cedi', symbol: 'GH₵', flag: '🇬🇭' },
  { countryName: 'Greece', countryCode: 'GR', currencyCode: 'EUR', currencyName: 'Euro', symbol: '€', flag: '🇬🇷' },
  { countryName: 'Grenada', countryCode: 'GD', currencyCode: 'XCD', currencyName: 'East Caribbean Dollar', symbol: 'EC$', flag: '🇬🇩' },
  { countryName: 'Guatemala', countryCode: 'GT', currencyCode: 'GTQ', currencyName: 'Guatemalan Quetzal', symbol: 'Q', flag: '🇬🇹' },
  { countryName: 'Guinea', countryCode: 'GN', currencyCode: 'GNF', currencyName: 'Guinean Franc', symbol: 'FG', flag: '🇬🇳' },
  { countryName: 'Guinea-Bissau', countryCode: 'GW', currencyCode: 'XOF', currencyName: 'West African CFA Franc', symbol: 'CFA', flag: '🇬🇼' },
  { countryName: 'Guyana', countryCode: 'GY', currencyCode: 'GYD', currencyName: 'Guyanaese Dollar', symbol: 'GY$', flag: '🇬🇾' },
  { countryName: 'Haiti', countryCode: 'HT', currencyCode: 'HTG', currencyName: 'Haitian Gourde', symbol: 'G', flag: '🇭🇹' },
  { countryName: 'Honduras', countryCode: 'HN', currencyCode: 'HNL', currencyName: 'Honduran Lempira', symbol: 'L', flag: '🇭🇳' },
  { countryName: 'Hong Kong', countryCode: 'HK', currencyCode: 'HKD', currencyName: 'Hong Kong Dollar', symbol: 'HK$', flag: '🇭🇰' },
  { countryName: 'Hungary', countryCode: 'HU', currencyCode: 'HUF', currencyName: 'Hungarian Forint', symbol: 'Ft', flag: '🇭🇺' },
  { countryName: 'Iceland', countryCode: 'IS', currencyCode: 'ISK', currencyName: 'Icelandic Króna', symbol: 'kr', flag: '🇮🇸' },
  { countryName: 'India', countryCode: 'IN', currencyCode: 'INR', currencyName: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
  { countryName: 'Indonesia', countryCode: 'ID', currencyCode: 'IDR', currencyName: 'Indonesian Rupiah', symbol: 'Rp', flag: '🇮🇩' },
  { countryName: 'Iran', countryCode: 'IR', currencyCode: 'IRR', currencyName: 'Iranian Rial', symbol: '﷼', flag: '🇮🇷' },
  { countryName: 'Iraq', countryCode: 'IQ', currencyCode: 'IQD', currencyName: 'Iraqi Dinar', symbol: 'د.ع', flag: '🇮🇶' },
  { countryName: 'Ireland', countryCode: 'IE', currencyCode: 'EUR', currencyName: 'Euro', symbol: '€', flag: '🇮🇪' },
  { countryName: 'Israel', countryCode: 'IL', currencyCode: 'ILS', currencyName: 'Israeli New Shekel', symbol: '₪', flag: '🇮🇱' },
  { countryName: 'Italy', countryCode: 'IT', currencyCode: 'EUR', currencyName: 'Euro', symbol: '€', flag: '🇮🇹' },
  { countryName: 'Ivory Coast (Côte d\'Ivoire)', countryCode: 'CI', currencyCode: 'XOF', currencyName: 'West African CFA Franc', symbol: 'CFA', flag: '🇨🇮' },
  { countryName: 'Jamaica', countryCode: 'JM', currencyCode: 'JMD', currencyName: 'Jamaican Dollar', symbol: 'J$', flag: '🇯🇲' },
  { countryName: 'Japan', countryCode: 'JP', currencyCode: 'JPY', currencyName: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
  { countryName: 'Jordan', countryCode: 'JO', currencyCode: 'JOD', currencyName: 'Jordanian Dinar', symbol: 'JD', flag: '🇯🇴' },
  { countryName: 'Kazakhstan', countryCode: 'KZ', currencyCode: 'KZT', currencyName: 'Kazakhstani Tenge', symbol: '₸', flag: '🇰🇿' },
  { countryName: 'Kenya', countryCode: 'KE', currencyCode: 'KES', currencyName: 'Kenyan Shilling', symbol: 'KSh', flag: '🇰🇪' },
  { countryName: 'Kiribati', countryCode: 'KI', currencyCode: 'AUD', currencyName: 'Australian Dollar', symbol: 'A$', flag: '🇰🇮' },
  { countryName: 'Kuwait', countryCode: 'KW', currencyCode: 'KWD', currencyName: 'Kuwaiti Dinar', symbol: 'KD', flag: '🇰🇼' },
  { countryName: 'Kyrgyzstan', countryCode: 'KG', currencyCode: 'KGS', currencyName: 'Kyrgystani Som', symbol: 'сом', flag: '🇰🇬' },
  { countryName: 'Laos', countryCode: 'LA', currencyCode: 'LAK', currencyName: 'Laotian Kip', symbol: '₭', flag: '🇱🇦' },
  { countryName: 'Latvia', countryCode: 'LV', currencyCode: 'EUR', currencyName: 'Euro', symbol: '€', flag: '🇱🇻' },
  { countryName: 'Lebanon', countryCode: 'LB', currencyCode: 'LBP', currencyName: 'Lebanese Pound', symbol: 'L£', flag: '🇱🇧' },
  { countryName: 'Lesotho', countryCode: 'LS', currencyCode: 'LSL', currencyName: 'Lesotho Loti', symbol: 'L', flag: '🇱🇸' },
  { countryName: 'Liberia', countryCode: 'LR', currencyCode: 'LRD', currencyName: 'Liberian Dollar', symbol: 'L$', flag: '🇱🇷' },
  { countryName: 'Libya', countryCode: 'LY', currencyCode: 'LYD', currencyName: 'Libyan Dinar', symbol: 'LD', flag: '🇱🇾' },
  { countryName: 'Liechtenstein', countryCode: 'LI', currencyCode: 'CHF', currencyName: 'Swiss Franc', symbol: 'CHF', flag: '🇱🇮' },
  { countryName: 'Lithuania', countryCode: 'LT', currencyCode: 'EUR', currencyName: 'Euro', symbol: '€', flag: '🇱🇹' },
  { countryName: 'Luxembourg', countryCode: 'LU', currencyCode: 'EUR', currencyName: 'Euro', symbol: '€', flag: '🇱🇺' },
  { countryName: 'Madagascar', countryCode: 'MG', currencyCode: 'MGA', currencyName: 'Malagasy Ariary', symbol: 'Ar', flag: '🇲🇬' },
  { countryName: 'Malawi', countryCode: 'MW', currencyCode: 'MWK', currencyName: 'Malawian Kwacha', symbol: 'MK', flag: '🇲🇼' },
  { countryName: 'Malaysia', countryCode: 'MY', currencyCode: 'MYR', currencyName: 'Malaysian Ringgit', symbol: 'RM', flag: '🇲🇾' },
  { countryName: 'Maldives', countryCode: 'MV', currencyCode: 'MVR', currencyName: 'Maldivian Rufiyaa', symbol: 'Rf', flag: '🇲🇻' },
  { countryName: 'Mali', countryCode: 'ML', currencyCode: 'XOF', currencyName: 'West African CFA Franc', symbol: 'CFA', flag: '🇲🇱' },
  { countryName: 'Malta', countryCode: 'MT', currencyCode: 'EUR', currencyName: 'Euro', symbol: '€', flag: '🇲🇹' },
  { countryName: 'Marshall Islands', countryCode: 'MH', currencyCode: 'USD', currencyName: 'US Dollar', symbol: '$', flag: '🇲🇭' },
  { countryName: 'Mauritania', countryCode: 'MR', currencyCode: 'MRU', currencyName: 'Mauritanian Ouguiya', symbol: 'UM', flag: '🇲🇷' },
  { countryName: 'Mauritius', countryCode: 'MU', currencyCode: 'MUR', currencyName: 'Mauritian Rupee', symbol: '₨', flag: '🇲🇺' },
  { countryName: 'Mexico', countryCode: 'MX', currencyCode: 'MXN', currencyName: 'Mexican Peso', symbol: 'Mex$', flag: '🇲🇽' },
  { countryName: 'Micronesia', countryCode: 'FM', currencyCode: 'USD', currencyName: 'US Dollar', symbol: '$', flag: '🇫🇲' },
  { countryName: 'Moldova', countryCode: 'MD', currencyCode: 'MDL', currencyName: 'Moldovan Leu', symbol: 'L', flag: '🇲🇩' },
  { countryName: 'Monaco', countryCode: 'MC', currencyCode: 'EUR', currencyName: 'Euro', symbol: '€', flag: '🇲🇨' },
  { countryName: 'Mongolia', countryCode: 'MN', currencyCode: 'MNT', currencyName: 'Mongolian Tugrik', symbol: '₮', flag: '🇲🇳' },
  { countryName: 'Montenegro', countryCode: 'ME', currencyCode: 'EUR', currencyName: 'Euro', symbol: '€', flag: '🇲🇪' },
  { countryName: 'Morocco', countryCode: 'MA', currencyCode: 'MAD', currencyName: 'Moroccan Dirham', symbol: 'DH', flag: '🇲🇦' },
  { countryName: 'Mozambique', countryCode: 'MZ', currencyCode: 'MZN', currencyName: 'Mozambican Metical', symbol: 'MT', flag: '🇲🇿' },
  { countryName: 'Myanmar (Burma)', countryCode: 'MM', currencyCode: 'MMK', currencyName: 'Myanmar Kyat', symbol: 'K', flag: '🇲🇲' },
  { countryName: 'Namibia', countryCode: 'NA', currencyCode: 'NAD', currencyName: 'Namibian Dollar', symbol: 'N$', flag: '🇳🇦' },
  { countryName: 'Nauru', countryCode: 'NR', currencyCode: 'AUD', currencyName: 'Australian Dollar', symbol: 'A$', flag: '🇳🇷' },
  { countryName: 'Nepal', countryCode: 'NP', currencyCode: 'NPR', currencyName: 'Nepalese Rupee', symbol: '₨', flag: '🇳🇵' },
  { countryName: 'Netherlands', countryCode: 'NL', currencyCode: 'EUR', currencyName: 'Euro', symbol: '€', flag: '🇳🇱' },
  { countryName: 'New Zealand', countryCode: 'NZ', currencyCode: 'NZD', currencyName: 'New Zealand Dollar', symbol: 'NZ$', flag: '🇳🇿' },
  { countryName: 'Nicaragua', countryCode: 'NI', currencyCode: 'NIO', currencyName: 'Nicaraguan Córdoba', symbol: 'C$', flag: '🇳🇮' },
  { countryName: 'Niger', countryCode: 'NE', currencyCode: 'XOF', currencyName: 'West African CFA Franc', symbol: 'CFA', flag: '🇳🇪' },
  { countryName: 'Nigeria', countryCode: 'NG', currencyCode: 'NGN', currencyName: 'Nigerian Naira', symbol: '₦', flag: '🇳🇬' },
  { countryName: 'North Macedonia', countryCode: 'MK', currencyCode: 'MKD', currencyName: 'Macedonian Denar', symbol: 'ден', flag: '🇲🇰' },
  { countryName: 'Norway', countryCode: 'NO', currencyCode: 'NOK', currencyName: 'Norwegian Krone', symbol: 'kr', flag: '🇳🇴' },
  { countryName: 'Oman', countryCode: 'OM', currencyCode: 'OMR', currencyName: 'Omani Rial', symbol: 'RO', flag: '🇴🇲' },
  { countryName: 'Pakistan', countryCode: 'PK', currencyCode: 'PKR', currencyName: 'Pakistani Rupee', symbol: 'Rs', flag: '🇵🇰' },
  { countryName: 'Palau', countryCode: 'PW', currencyCode: 'USD', currencyName: 'US Dollar', symbol: '$', flag: '🇵🇼' },
  { countryName: 'Palestine', countryCode: 'PS', currencyCode: 'ILS', currencyName: 'Israeli New Shekel', symbol: '₪', flag: '🇵🇸' },
  { countryName: 'Panama', countryCode: 'PA', currencyCode: 'USD', currencyName: 'US Dollar', symbol: '$', flag: '🇵🇦' },
  { countryName: 'Papua New Guinea', countryCode: 'PG', currencyCode: 'PGK', currencyName: 'Papua New Guinean Kina', symbol: 'K', flag: '🇵🇬' },
  { countryName: 'Paraguay', countryCode: 'PY', currencyCode: 'PYG', currencyName: 'Paraguayan Guarani', symbol: '₲', flag: '🇵🇾' },
  { countryName: 'Peru', countryCode: 'PE', currencyCode: 'PEN', currencyName: 'Peruvian Sol', symbol: 'S/', flag: '🇵🇪' },
  { countryName: 'Philippines', countryCode: 'PH', currencyCode: 'PHP', currencyName: 'Philippine Peso', symbol: '₱', flag: '🇵🇭' },
  { countryName: 'Poland', countryCode: 'PL', currencyCode: 'PLN', currencyName: 'Polish Zloty', symbol: 'zł', flag: '🇵🇱' },
  { countryName: 'Portugal', countryCode: 'PT', currencyCode: 'EUR', currencyName: 'Euro', symbol: '€', flag: '🇵🇹' },
  { countryName: 'Qatar', countryCode: 'QA', currencyCode: 'QAR', currencyName: 'Qatari Rial', symbol: 'QR', flag: '🇶🇦' },
  { countryName: 'Romania', countryCode: 'RO', currencyCode: 'RON', currencyName: 'Romanian Leu', symbol: 'lei', flag: '🇷🇴' },
  { countryName: 'Rwanda', countryCode: 'RW', currencyCode: 'RWF', currencyName: 'Rwandan Franc', symbol: 'FRw', flag: '🇷🇼' },
  { countryName: 'Saint Kitts and Nevis', countryCode: 'KN', currencyCode: 'XCD', currencyName: 'East Caribbean Dollar', symbol: 'EC$', flag: '🇰🇳' },
  { countryName: 'Saint Lucia', countryCode: 'LC', currencyCode: 'XCD', currencyName: 'East Caribbean Dollar', symbol: 'EC$', flag: '🇱🇨' },
  { countryName: 'Saint Vincent and the Grenadines', countryCode: 'VC', currencyCode: 'XCD', currencyName: 'East Caribbean Dollar', symbol: 'EC$', flag: '🇻🇨' },
  { countryName: 'Samoa', countryCode: 'WS', currencyCode: 'WST', currencyName: 'Samoan Tala', symbol: 'WS$', flag: '🇼🇸' },
  { countryName: 'San Marino', countryCode: 'SM', currencyCode: 'EUR', currencyName: 'Euro', symbol: '€', flag: '🇸🇲' },
  { countryName: 'Sao Tome and Principe', countryCode: 'ST', currencyCode: 'STN', currencyName: 'São Tomé and Príncipe Dobra', symbol: 'Db', flag: '🇸🇹' },
  { countryName: 'Saudi Arabia', countryCode: 'SA', currencyCode: 'SAR', currencyName: 'Saudi Riyal', symbol: 'SAR', flag: '🇸🇦' },
  { countryName: 'Senegal', countryCode: 'SN', currencyCode: 'XOF', currencyName: 'West African CFA Franc', symbol: 'CFA', flag: '🇸🇳' },
  { countryName: 'Serbia', countryCode: 'RS', currencyCode: 'RSD', currencyName: 'Serbian Dinar', symbol: 'din.', flag: '🇷🇸' },
  { countryName: 'Seychelles', countryCode: 'SC', currencyCode: 'SCR', currencyName: 'Seychellois Rupee', symbol: 'SR', flag: '🇸🇨' },
  { countryName: 'Sierra Leone', countryCode: 'SL', currencyCode: 'SLE', currencyName: 'Sierra Leonean Leone', symbol: 'Le', flag: '🇸🇱' },
  { countryName: 'Singapore', countryCode: 'SG', currencyCode: 'SGD', currencyName: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬' },
  { countryName: 'Slovakia', countryCode: 'SK', currencyCode: 'EUR', currencyName: 'Euro', symbol: '€', flag: '🇸🇰' },
  { countryName: 'Slovenia', countryCode: 'SI', currencyCode: 'EUR', currencyName: 'Euro', symbol: '€', flag: '🇸🇮' },
  { countryName: 'Solomon Islands', countryCode: 'SB', currencyCode: 'SBD', currencyName: 'Solomon Islands Dollar', symbol: 'SI$', flag: '🇸🇧' },
  { countryName: 'Somalia', countryCode: 'SO', currencyCode: 'SOS', currencyName: 'Somali Shilling', symbol: 'S', flag: '🇸🇴' },
  { countryName: 'South Africa', countryCode: 'ZA', currencyCode: 'ZAR', currencyName: 'South African Rand', symbol: 'R', flag: '🇿🇦' },
  { countryName: 'South Korea', countryCode: 'KR', currencyCode: 'KRW', currencyName: 'South Korean Won', symbol: '₩', flag: '🇰🇷' },
  { countryName: 'South Sudan', countryCode: 'SS', currencyCode: 'SSP', currencyName: 'South Sudanese Pound', symbol: '£', flag: '🇸🇸' },
  { countryName: 'Spain', countryCode: 'ES', currencyCode: 'EUR', currencyName: 'Euro', symbol: '€', flag: '🇪🇸' },
  { countryName: 'Sri Lanka', countryCode: 'LK', currencyCode: 'LKR', currencyName: 'Sri Lankan Rupee', symbol: 'Rs', flag: '🇱🇰' },
  { countryName: 'Sudan', countryCode: 'SD', currencyCode: 'SDG', currencyName: 'Sudanese Pound', symbol: 'SDG', flag: '🇸🇩' },
  { countryName: 'Suriname', countryCode: 'SR', currencyCode: 'SRD', currencyName: 'Surinamese Dollar', symbol: '$', flag: '🇸🇷' },
  { countryName: 'Sweden', countryCode: 'SE', currencyCode: 'SEK', currencyName: 'Swedish Krona', symbol: 'kr', flag: '🇸🇪' },
  { countryName: 'Switzerland', countryCode: 'CH', currencyCode: 'CHF', currencyName: 'Swiss Franc', symbol: 'CHF', flag: '🇨🇭' },
  { countryName: 'Syria', countryCode: 'SY', currencyCode: 'SYP', currencyName: 'Syrian Pound', symbol: '£', flag: '🇸🇾' },
  { countryName: 'Taiwan', countryCode: 'TW', currencyCode: 'TWD', currencyName: 'New Taiwan Dollar', symbol: 'NT$', flag: '🇹🇼' },
  { countryName: 'Tajikistan', countryCode: 'TJ', currencyCode: 'TJS', currencyName: 'Tajikistani Somoni', symbol: 'SM', flag: '🇹🇯' },
  { countryName: 'Tanzania', countryCode: 'TZ', currencyCode: 'TZS', currencyName: 'Tanzanian Shilling', symbol: 'TSh', flag: '🇹🇿' },
  { countryName: 'Thailand', countryCode: 'TH', currencyCode: 'THB', currencyName: 'Thai Baht', symbol: '฿', flag: '🇹🇭' },
  { countryName: 'Timor-Leste', countryCode: 'TL', currencyCode: 'USD', currencyName: 'US Dollar', symbol: '$', flag: '🇹🇱' },
  { countryName: 'Togo', countryCode: 'TG', currencyCode: 'XOF', currencyName: 'West African CFA Franc', symbol: 'CFA', flag: '🇹🇬' },
  { countryName: 'Tonga', countryCode: 'TO', currencyCode: 'TOP', currencyName: 'Tongan Paʻanga', symbol: 'T$', flag: '🇹🇴' },
  { countryName: 'Trinidad and Tobago', countryCode: 'TT', currencyCode: 'TTD', currencyName: 'Trinidad and Tobago Dollar', symbol: 'TT$', flag: '🇹🇹' },
  { countryName: 'Tunisia', countryCode: 'TN', currencyCode: 'TND', currencyName: 'Tunisian Dinar', symbol: 'DT', flag: '🇹🇳' },
  { countryName: 'Turkey', countryCode: 'TR', currencyCode: 'TRY', currencyName: 'Turkish Lira', symbol: '₺', flag: '🇹🇷' },
  { countryName: 'Turkmenistan', countryCode: 'TM', currencyCode: 'TMT', currencyName: 'Turkmenistani Manat', symbol: 'T', flag: '🇹🇲' },
  { countryName: 'Tuvalu', countryCode: 'TV', currencyCode: 'AUD', currencyName: 'Australian Dollar', symbol: 'A$', flag: '🇹🇻' },
  { countryName: 'Uganda', countryCode: 'UG', currencyCode: 'UGX', currencyName: 'Ugandan Shilling', symbol: 'USh', flag: '🇺🇬' },
  { countryName: 'Ukraine', countryCode: 'UA', currencyCode: 'UAH', currencyName: 'Ukrainian Hryvnia', symbol: '₴', flag: '🇺🇦' },
  { countryName: 'United Arab Emirates', countryCode: 'AE', currencyCode: 'AED', currencyName: 'UAE Dirham', symbol: 'AED', flag: '🇦🇪' },
  { countryName: 'United Kingdom', countryCode: 'GB', currencyCode: 'GBP', currencyName: 'British Pound', symbol: '£', flag: '🇬🇧' },
  { countryName: 'United States', countryCode: 'US', currencyCode: 'USD', currencyName: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { countryName: 'Uruguay', countryCode: 'UY', currencyCode: 'UYU', currencyName: 'Uruguayan Peso', symbol: '$U', flag: '🇺🇾' },
  { countryName: 'Uzbekistan', countryCode: 'UZ', currencyCode: 'UZS', currencyName: 'Uzbekistani Som', symbol: 'soʻm', flag: '🇺🇿' },
  { countryName: 'Vanuatu', countryCode: 'VU', currencyCode: 'VUV', currencyName: 'Vanuatu Vatu', symbol: 'VT', flag: '🇻🇺' },
  { countryName: 'Vatican City', countryCode: 'VA', currencyCode: 'EUR', currencyName: 'Euro', symbol: '€', flag: '🇻🇦' },
  { countryName: 'Venezuela', countryCode: 'VE', currencyCode: 'VES', currencyName: 'Venezuelan Bolívar', symbol: 'Bs.', flag: '🇻🇪' },
  { countryName: 'Vietnam', countryCode: 'VN', currencyCode: 'VND', currencyName: 'Vietnamese Dong', symbol: '₫', flag: '🇻🇳' },
  { countryName: 'Yemen', countryCode: 'YE', currencyCode: 'YER', currencyName: 'Yemeni Rial', symbol: '﷼', flag: '🇾🇪' },
  { countryName: 'Zambia', countryCode: 'ZM', currencyCode: 'ZMW', currencyName: 'Zambian Kwacha', symbol: 'K', flag: '🇿🇲' },
  { countryName: 'Zimbabwe', countryCode: 'ZW', currencyCode: 'ZWG', currencyName: 'Zimbabwe Gold', symbol: 'ZiG', flag: '🇿🇼' },
];

/**
 * Returns currency code (e.g. 'USD', 'EUR', 'JPY', 'MNT') for a given country name or code.
 */
export function getCurrencyForCountry(countryNameOrCode?: string): string {
  if (!countryNameOrCode) return 'USD';
  const query = countryNameOrCode.trim().toLowerCase();
  const match = SUPPORTED_COUNTRIES.find(
    (c) =>
      c.countryName.toLowerCase() === query ||
      c.countryCode.toLowerCase() === query
  );
  return match ? match.currencyCode : 'USD';
}

/**
 * Returns country info object.
 */
export function getCountryOption(countryNameOrCode?: string): CountryCurrencyOption | undefined {
  if (!countryNameOrCode) return undefined;
  const query = countryNameOrCode.trim().toLowerCase();
  return SUPPORTED_COUNTRIES.find(
    (c) =>
      c.countryName.toLowerCase() === query ||
      c.countryCode.toLowerCase() === query
  );
}

/**
 * Returns the localized symbol for a currency code.
 */
export function getCurrencySymbol(currencyCode: string = 'USD'): string {
  const code = (currencyCode || 'USD').toUpperCase();
  const match = SUPPORTED_COUNTRIES.find((c) => c.currencyCode.toUpperCase() === code);
  if (match) return match.symbol;

  try {
    const parts = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0);
    const currencyPart = parts.find((p) => p.type === 'currency');
    return currencyPart ? currencyPart.value : code;
  } catch {
    return code;
  }
}

/**
 * Formats monetary amounts using real ISO 4217 standard rules via Intl.NumberFormat.
 * 
 * At display time: if the amount's nativeCurrency differs from the user's current
 * display currency preference (currencyCode), converts it live using the cached/live exchange
 * rate before formatting — the stored number itself never changes, only what's shown.
 * 
 * Currencies without minor units (e.g., JPY, KRW, VND, CLP, XAF, XOF) will NOT have forced .00 decimals,
 * while 2-decimal currencies (USD, EUR, GBP) format with 2 decimals naturally.
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currencyCode: string = 'USD',
  optionsOrNativeCurrency?: (Intl.NumberFormatOptions & { nativeCurrency?: string }) | string,
  nativeCurrencyParam?: string
): string {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount || 0));
  if (isNaN(num)) {
    return '0';
  }

  let options: Intl.NumberFormatOptions | undefined = undefined;
  let nativeCurrency: string | undefined = undefined;

  if (typeof optionsOrNativeCurrency === 'string') {
    nativeCurrency = optionsOrNativeCurrency;
  } else if (optionsOrNativeCurrency && typeof optionsOrNativeCurrency === 'object') {
    options = optionsOrNativeCurrency;
    if ('nativeCurrency' in optionsOrNativeCurrency && typeof (optionsOrNativeCurrency as any).nativeCurrency === 'string') {
      nativeCurrency = (optionsOrNativeCurrency as any).nativeCurrency;
    }
  }

  if (nativeCurrencyParam) {
    nativeCurrency = nativeCurrencyParam;
  }

  const displayCurrency = (currencyCode || 'USD').toUpperCase();
  const sourceCurrency = (nativeCurrency || displayCurrency).toUpperCase();

  // Convert live from nativeCurrency to display currency
  const convertedAmount = convertCurrency(num, sourceCurrency, displayCurrency);

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: displayCurrency,
      ...options,
    }).format(convertedAmount);
  } catch {
    return `${displayCurrency} ${convertedAmount.toLocaleString('en-US')}`;
  }
}

/**
 * Formats integer/whole rounded currency (useful for big goal cards, charts, progress milestones).
 * Converts live from nativeCurrency to display currency if different.
 */
export function formatWholeCurrency(
  amount: number | string | null | undefined,
  currencyCode: string = 'USD',
  nativeCurrency?: string
): string {
  return formatCurrency(
    amount,
    currencyCode,
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      nativeCurrency,
    },
    nativeCurrency
  );
}
