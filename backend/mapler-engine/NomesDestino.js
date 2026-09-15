const palavras = {
  c: 'auto break case char const continue default do double else enum extern float for goto if inline int long register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while _Alignas _Alignof _Atomic _Bool _Complex _Generic _Imaginary _Noreturn _Static_assert _Thread_local',
  cpp: 'alignas alignof and and_eq asm auto bitand bitor bool break case catch char char8_t char16_t char32_t class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept not not_eq nullptr operator or or_eq private protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast struct switch template this thread_local throw true try typedef typeid typename union unsigned using virtual void volatile wchar_t while xor xor_eq',
  java: 'abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null _ var yield record sealed permits',
  javascript: 'await break case catch class const continue debugger default delete do else enum export extends false finally for function if implements import in instanceof interface let new null package private protected public return static super switch this throw true try typeof var void while with yield',
  typescript: 'abstract any as asserts async await bigint boolean break case catch class const constructor continue debugger declare default delete do else enum export extends false finally for from function get global if implements import in infer instanceof interface is keyof let module namespace never new null number object of out override package private protected public readonly require return satisfies set static string super switch symbol this throw true try type typeof undefined unique unknown using var void while with yield',
  python: 'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield',
  ruby: 'BEGIN END alias and begin break case class def defined do else elsif end ensure false for if in module next nil not or redo rescue retry return self super then true undef unless until when while yield __FILE__ __LINE__ __ENCODING__',
  coffeescript: 'and await break by catch class continue debugger delete do else extends false finally for from if in instanceof is isnt loop new no not null of off on or return super switch then this throw true try typeof undefined unless until when while yes yield own import export default let const var function void with implements interface package private protected public static',
  pascal: 'absolute abstract and array as asm assembler automated begin case cdecl class const constructor contains default deprecated destructor dispid dispinterface div do downto dynamic else end except exit experimental export exports external far file final finalization finally for forward function generic goto helper if implementation in index inherited initialization inline interface interrupt is label library local message mod name near nil nodefault not object of on operator or out overload override packed pascal platform private procedure program property protected public published raise read record register reintroduce repeat requires resourcestring safecall sealed set shl shr specialize static stdcall stored strict string then threadvar to try type unit until uses var virtual while with write xor true false result',
};

const runtime = {
  c: 'main entrada printf scanf puts fputs putchar fgets snprintf stdin stdout stderr NULL exit strtoll strtod strlen strcpy strcat strcmp strcspn pow fmod trunc isfinite bool true false',
  cpp: 'main std exit',
  java: 'Programa entrada args System String Long Double Math IllegalArgumentException IllegalStateException java',
  javascript: 'console require String Number Boolean Array Error Infinity NaN undefined',
  typescript: 'console require String Number Boolean Array Error Infinity NaN',
  coffeescript: 'console require String Number Boolean Array Error Infinity NaN',
  python: 'print input str int float bool range math isinstance global __name__',
  ruby: 'STDIN Array Integer Float puts raise',
  pascal: 'Programa Input Output ReadLn WriteLn Length LowerCase StrToInt64 StrToFloat IntToStr FloatToStr Trunc Power IsNan IsInfinite Exception DefaultFormatSettings SysUtils Math',
};
const auxiliares = 'MaplerTexto maplerTexto maplerLer maplerConcat maplerNumero maplerInteiro maplerBool mapler_texto mapler_ler maplerEntradas maplerIndice maplerValorEntrada';

/** Mantém o nome legível e reserva sufixos apenas para colisões reais no destino. */
export function criarNomesDestino(linguagem, originais = []) {
  const chave = nome => linguagem === 'pascal' ? nome.toLowerCase() : nome;
  const reservados = new Set(`${palavras[linguagem]} ${runtime[linguagem]} ${auxiliares}`.split(/\s+/).map(chave));
  const fontes = new Set(originais.map(chave));
  const usados = new Set();
  return nome => {
    let base = nome.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_]/g, '_');
    if (!/^[a-zA-Z_]/.test(base)) base = `variavel_${base}`;
    if (linguagem === 'ruby') base = base.replace(/^[A-Z]/, c => c.toLowerCase());
    if (['c', 'cpp'].includes(linguagem) && /^(__|_[A-Z])/.test(base)) base = `variavel${base}`;
    let candidato = base;
    let sufixo = 0;
    while (reservados.has(chave(candidato)) || usados.has(chave(candidato)) || (candidato !== nome && fontes.has(chave(candidato)))) {
      candidato = `${base}_${++sufixo}`;
    }
    usados.add(chave(candidato));
    return candidato;
  };
}
