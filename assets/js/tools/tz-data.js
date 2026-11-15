// Fixlytools - countries and their main IANA time zones for the Time Zone Converter.
// Format per line: ISO code | country name | zone [; zone ...] where a zone is either "IANA" or "Label:IANA".
const TZ_RAW = `
AF|Afghanistan|Asia/Kabul
AL|Albania|Europe/Tirane
DZ|Algeria|Africa/Algiers
AD|Andorra|Europe/Andorra
AO|Angola|Africa/Luanda
AG|Antigua and Barbuda|America/Antigua
AR|Argentina|America/Argentina/Buenos_Aires
AM|Armenia|Asia/Yerevan
AU|Australia|Sydney:Australia/Sydney;Melbourne:Australia/Melbourne;Brisbane:Australia/Brisbane;Adelaide:Australia/Adelaide;Perth:Australia/Perth;Darwin:Australia/Darwin;Hobart:Australia/Hobart
AT|Austria|Europe/Vienna
AZ|Azerbaijan|Asia/Baku
BS|Bahamas|America/Nassau
BH|Bahrain|Asia/Bahrain
BD|Bangladesh|Asia/Dhaka
BB|Barbados|America/Barbados
BY|Belarus|Europe/Minsk
BE|Belgium|Europe/Brussels
BZ|Belize|America/Belize
BJ|Benin|Africa/Porto-Novo
BT|Bhutan|Asia/Thimphu
BO|Bolivia|America/La_Paz
BA|Bosnia and Herzegovina|Europe/Sarajevo
BW|Botswana|Africa/Gaborone
BR|Brazil|Brasilia and Sao Paulo:America/Sao_Paulo;Manaus:America/Manaus;Fortaleza:America/Fortaleza;Rio Branco:America/Rio_Branco;Fernando de Noronha:America/Noronha
BN|Brunei|Asia/Brunei
BG|Bulgaria|Europe/Sofia
BF|Burkina Faso|Africa/Ouagadougou
BI|Burundi|Africa/Bujumbura
CV|Cabo Verde|Atlantic/Cape_Verde
KH|Cambodia|Asia/Phnom_Penh
CM|Cameroon|Africa/Douala
CA|Canada|Toronto (Eastern):America/Toronto;Winnipeg (Central):America/Winnipeg;Edmonton (Mountain):America/Edmonton;Vancouver (Pacific):America/Vancouver;Halifax (Atlantic):America/Halifax;St. John's (Newfoundland):America/St_Johns;Regina (Saskatchewan):America/Regina
CF|Central African Republic|Africa/Bangui
TD|Chad|Africa/Ndjamena
CL|Chile|America/Santiago
CN|China|Asia/Shanghai
CO|Colombia|America/Bogota
KM|Comoros|Indian/Comoro
CG|Congo (Republic of the)|Africa/Brazzaville
CD|Congo (Democratic Republic of the)|Kinshasa:Africa/Kinshasa;Lubumbashi:Africa/Lubumbashi
CR|Costa Rica|America/Costa_Rica
CI|Cote d'Ivoire|Africa/Abidjan
HR|Croatia|Europe/Zagreb
CU|Cuba|America/Havana
CY|Cyprus|Asia/Nicosia
CZ|Czechia|Europe/Prague
DK|Denmark|Europe/Copenhagen
DJ|Djibouti|Africa/Djibouti
DM|Dominica|America/Dominica
DO|Dominican Republic|America/Santo_Domingo
EC|Ecuador|America/Guayaquil
EG|Egypt|Africa/Cairo
SV|El Salvador|America/El_Salvador
GQ|Equatorial Guinea|Africa/Malabo
ER|Eritrea|Africa/Asmara
EE|Estonia|Europe/Tallinn
SZ|Eswatini|Africa/Mbabane
ET|Ethiopia|Africa/Addis_Ababa
FJ|Fiji|Pacific/Fiji
FI|Finland|Europe/Helsinki
FR|France|Europe/Paris
GA|Gabon|Africa/Libreville
GM|Gambia|Africa/Banjul
GE|Georgia|Asia/Tbilisi
DE|Germany|Europe/Berlin
GH|Ghana|Africa/Accra
GR|Greece|Europe/Athens
GL|Greenland|America/Nuuk
GD|Grenada|America/Grenada
GT|Guatemala|America/Guatemala
GN|Guinea|Africa/Conakry
GW|Guinea-Bissau|Africa/Bissau
GY|Guyana|America/Guyana
HT|Haiti|America/Port-au-Prince
HN|Honduras|America/Tegucigalpa
HK|Hong Kong|Asia/Hong_Kong
HU|Hungary|Europe/Budapest
IS|Iceland|Atlantic/Reykjavik
IN|India|Asia/Kolkata
ID|Indonesia|Jakarta (Western):Asia/Jakarta;Makassar (Central):Asia/Makassar;Jayapura (Eastern):Asia/Jayapura
IR|Iran|Asia/Tehran
IQ|Iraq|Asia/Baghdad
IE|Ireland|Europe/Dublin
IL|Israel|Asia/Jerusalem
IT|Italy|Europe/Rome
JM|Jamaica|America/Jamaica
JP|Japan|Asia/Tokyo
JO|Jordan|Asia/Amman
KZ|Kazakhstan|Asia/Almaty
KE|Kenya|Africa/Nairobi
KI|Kiribati|Pacific/Tarawa
XK|Kosovo|Europe/Belgrade
KW|Kuwait|Asia/Kuwait
KG|Kyrgyzstan|Asia/Bishkek
LA|Laos|Asia/Vientiane
LV|Latvia|Europe/Riga
LB|Lebanon|Asia/Beirut
LS|Lesotho|Africa/Maseru
LR|Liberia|Africa/Monrovia
LY|Libya|Africa/Tripoli
LI|Liechtenstein|Europe/Vaduz
LT|Lithuania|Europe/Vilnius
LU|Luxembourg|Europe/Luxembourg
MO|Macau|Asia/Macau
MG|Madagascar|Indian/Antananarivo
MW|Malawi|Africa/Blantyre
MY|Malaysia|Asia/Kuala_Lumpur
MV|Maldives|Indian/Maldives
ML|Mali|Africa/Bamako
MT|Malta|Europe/Malta
MH|Marshall Islands|Pacific/Majuro
MR|Mauritania|Africa/Nouakchott
MU|Mauritius|Indian/Mauritius
MX|Mexico|Mexico City:America/Mexico_City;Cancun:America/Cancun;Tijuana:America/Tijuana;Chihuahua:America/Chihuahua;Hermosillo:America/Hermosillo
FM|Micronesia|Pacific/Pohnpei
MD|Moldova|Europe/Chisinau
MC|Monaco|Europe/Monaco
MN|Mongolia|Asia/Ulaanbaatar
ME|Montenegro|Europe/Podgorica
MA|Morocco|Africa/Casablanca
MZ|Mozambique|Africa/Maputo
MM|Myanmar|Asia/Yangon
NA|Namibia|Africa/Windhoek
NR|Nauru|Pacific/Nauru
NP|Nepal|Asia/Kathmandu
NL|Netherlands|Europe/Amsterdam
NZ|New Zealand|Pacific/Auckland
NI|Nicaragua|America/Managua
NE|Niger|Africa/Niamey
NG|Nigeria|Africa/Lagos
KP|North Korea|Asia/Pyongyang
MK|North Macedonia|Europe/Skopje
NO|Norway|Europe/Oslo
OM|Oman|Asia/Muscat
PK|Pakistan|Asia/Karachi
PW|Palau|Pacific/Palau
PS|Palestine|Asia/Gaza
PA|Panama|America/Panama
PG|Papua New Guinea|Pacific/Port_Moresby
PY|Paraguay|America/Asuncion
PE|Peru|America/Lima
PH|Philippines|Asia/Manila
PL|Poland|Europe/Warsaw
PT|Portugal|Lisbon:Europe/Lisbon;Azores:Atlantic/Azores
PR|Puerto Rico|America/Puerto_Rico
QA|Qatar|Asia/Qatar
RO|Romania|Europe/Bucharest
RU|Russia|Moscow:Europe/Moscow;Kaliningrad:Europe/Kaliningrad;Samara:Europe/Samara;Yekaterinburg:Asia/Yekaterinburg;Omsk:Asia/Omsk;Novosibirsk:Asia/Novosibirsk;Krasnoyarsk:Asia/Krasnoyarsk;Irkutsk:Asia/Irkutsk;Yakutsk:Asia/Yakutsk;Vladivostok:Asia/Vladivostok;Magadan:Asia/Magadan;Kamchatka:Asia/Kamchatka
RW|Rwanda|Africa/Kigali
KN|Saint Kitts and Nevis|America/St_Kitts
LC|Saint Lucia|America/St_Lucia
VC|Saint Vincent and the Grenadines|America/St_Vincent
WS|Samoa|Pacific/Apia
SM|San Marino|Europe/San_Marino
ST|Sao Tome and Principe|Africa/Sao_Tome
SA|Saudi Arabia|Asia/Riyadh
SN|Senegal|Africa/Dakar
RS|Serbia|Europe/Belgrade
SC|Seychelles|Indian/Mahe
SL|Sierra Leone|Africa/Freetown
SG|Singapore|Asia/Singapore
SK|Slovakia|Europe/Bratislava
SI|Slovenia|Europe/Ljubljana
SB|Solomon Islands|Pacific/Guadalcanal
SO|Somalia|Africa/Mogadishu
ZA|South Africa|Africa/Johannesburg
KR|South Korea|Asia/Seoul
SS|South Sudan|Africa/Juba
ES|Spain|Madrid (mainland):Europe/Madrid;Canary Islands:Atlantic/Canary
LK|Sri Lanka|Asia/Colombo
SD|Sudan|Africa/Khartoum
SR|Suriname|America/Paramaribo
SE|Sweden|Europe/Stockholm
CH|Switzerland|Europe/Zurich
SY|Syria|Asia/Damascus
TW|Taiwan|Asia/Taipei
TJ|Tajikistan|Asia/Dushanbe
TZ|Tanzania|Africa/Dar_es_Salaam
TH|Thailand|Asia/Bangkok
TL|Timor-Leste|Asia/Dili
TG|Togo|Africa/Lome
TO|Tonga|Pacific/Tongatapu
TT|Trinidad and Tobago|America/Port_of_Spain
TN|Tunisia|Africa/Tunis
TR|Turkey|Europe/Istanbul
TM|Turkmenistan|Asia/Ashgabat
TV|Tuvalu|Pacific/Funafuti
UG|Uganda|Africa/Kampala
UA|Ukraine|Europe/Kiev
AE|United Arab Emirates|Asia/Dubai
GB|United Kingdom|Europe/London
US|United States|New York (Eastern):America/New_York;Chicago (Central):America/Chicago;Denver (Mountain):America/Denver;Phoenix (Arizona):America/Phoenix;Los Angeles (Pacific):America/Los_Angeles;Anchorage (Alaska):America/Anchorage;Honolulu (Hawaii):Pacific/Honolulu
UY|Uruguay|America/Montevideo
UZ|Uzbekistan|Asia/Tashkent
VU|Vanuatu|Pacific/Efate
VA|Vatican City|Europe/Vatican
VE|Venezuela|America/Caracas
VN|Vietnam|Asia/Ho_Chi_Minh
YE|Yemen|Asia/Aden
ZM|Zambia|Africa/Lusaka
ZW|Zimbabwe|Africa/Harare
`;

const TZ_COUNTRIES = TZ_RAW.trim().split('\n').map((line) => {
  const [code, name, zones] = line.split('|');
  return {
    code,
    name,
    zones: zones.split(';').map((z) => {
      const i = z.lastIndexOf(':');
      return i === -1 ? { label: '', tz: z } : { label: z.slice(0, i), tz: z.slice(i + 1) };
    })
  };
}).sort((a, b) => a.name.localeCompare(b.name));

if (typeof module !== 'undefined') {
  module.exports = { TZ_COUNTRIES };
}
