// SPDX-License-Identifier: AGPL-3.0-only
// 15-minute volunteer training and quiz. A helper cannot open a case until they pass (the server enforces it).
// Three parts: privacy, the line between organizing and advising, and conflicts.
//
// *** DRAFT FOR COUNSEL REVIEW. *** Every word of the training and the quiz, in English and in Spanish, must be read by
// a Florida lawyer (and the Spanish by a Spanish speaker) before real volunteers use it. When counsel has approved the
// text, change `version` (for example to "1"): every helper then takes the training again.
//
// This file holds the answer key, so only the server imports it. The page gets publicTraining(), which has no answers.

export const TRAINING = {
  version: "draft-1",
  draft: true,
  minutes: 15,
  pass: { correct: 8, of: 10, criticalAllRight: true },
  draftNotice: {
    en: "DRAFT FOR COUNSEL REVIEW. This training has not been approved by a lawyer yet. Do not rely on it as final.",
    es: "BORRADOR PARA REVISIÓN DEL ABOGADO. Esta capacitación todavía no ha sido aprobada por un abogado. No la tome como definitiva.",
  },
  modules: [
    {
      id: "privacy",
      title: { en: "1. Privacy: only the people on a case see it", es: "1. Privacidad: solo las personas del caso lo ven" },
      paras: {
        en: [
          "Only the people on a case see it. Every case has its own list of people. If you are not on the list, you do not see the case. Being a volunteer is not enough.",
          "Keep everything inside the app. Do not copy papers, photos, names or notes into text messages, personal email, social media, a personal cloud drive or a chat with a friend, even to ask a quick question.",
          "Papers can hold private numbers, such as a Social Security number. Leave them where they are. The app hides numbers that look like a Social Security number when a photo is saved, but it can miss one.",
          "The person whose case it is can see every time someone opens it. Your name and the time are written down. Only open a case you were asked to help with.",
          "Use your own login and do not share it. Sign out on a shared phone or computer.",
          "The papers never train AI. Do not paste a case into an AI chat tool outside this app.",
          "If you make a mistake, such as sending something to the wrong person or opening the wrong case, tell the program lead at once. A fast report is a good thing.",
          "If anyone is in danger: in an emergency, call 911. In a mental-health or suicide crisis, call or text 988.",
        ],
        es: [
          "Solo las personas del caso lo ven. Cada caso tiene su propia lista de personas. Si usted no está en la lista, no ve el caso. Ser voluntario no basta.",
          "Mantenga todo dentro de la aplicación. No copie papeles, fotos, nombres ni notas en mensajes de texto, correo personal, redes sociales, una nube personal ni un chat con un amigo, ni siquiera para hacer una pregunta rápida.",
          "Los papeles pueden tener números privados, como un número de Seguro Social. Déjelos donde están. La aplicación oculta los números que parecen un número de Seguro Social cuando se guarda una foto, pero puede pasar por alto alguno.",
          "La persona dueña del caso puede ver cada vez que alguien lo abre. Su nombre y la hora quedan anotados. Abra solamente un caso en el que le pidieron ayudar.",
          "Use su propio acceso y no lo comparta. Cierre la sesión en un teléfono o una computadora compartidos.",
          "Los papeles nunca entrenan a la IA. No pegue un caso en una herramienta de chat de IA fuera de esta aplicación.",
          "Si comete un error, como enviar algo a la persona equivocada o abrir el caso equivocado, avise de inmediato al líder del programa. Avisar rápido es algo bueno.",
          "Si alguien está en peligro: en una emergencia, llame al 911. En una crisis de salud mental o de suicidio, llame o envíe un mensaje de texto al 988.",
        ],
      },
    },
    {
      id: "no-advice",
      title: { en: "2. The line between organizing and advising", es: "2. La línea entre organizar y aconsejar" },
      paras: {
        en: [
          "Legal Agente organizes cases and matches people with volunteers. Only a licensed lawyer gives legal advice. The AI in the app organizes and finds facts in the papers. It never gives legal advice.",
          "Advice means telling someone what to do or what will happen: whether to pay, sign, settle or go to court; whether they will win; what a law means for their case; which choice is best.",
          "Helpers who are not lawyers (students, peer guides, retired judges acting as guides, builders) can: help find and sort papers; point out dates and names written on a paper; explain what a word or a form asks, in plain words, without saying what to answer; point to official places and to the volunteer lawyer; listen; and write questions down for the lawyer.",
          "Helpers who are not lawyers cannot: say what someone should do; predict a result; choose a legal option for someone; or fill in a legal answer for them.",
          "A good answer when someone asks what to do: \"That is a question for the volunteer lawyer. I will write it down for them, and I can help you gather the papers they will need.\"",
          "A note from a helper who is not a lawyer goes to the case team first. It reaches the person only after the supervising lawyer approves it.",
          "Never call the tool or any helper a lawyer, and never describe it as one.",
        ],
        es: [
          "Legal Agente organiza casos y conecta a las personas con voluntarios. Solo un abogado con licencia da consejo legal. La IA de la aplicación organiza y encuentra datos en los papeles. Nunca da consejo legal.",
          "Aconsejar es decirle a alguien qué hacer o qué va a pasar: si debe pagar, firmar, llegar a un acuerdo o ir al tribunal; si va a ganar; qué significa una ley para su caso; cuál opción es la mejor.",
          "Los ayudantes que no son abogados (estudiantes, guías de la comunidad, jueces jubilados que actúan como guías, constructores) pueden: ayudar a encontrar y ordenar papeles; señalar las fechas y los nombres escritos en un papel; explicar en palabras sencillas qué pide una palabra o un formulario, sin decir qué responder; señalar lugares oficiales y al abogado voluntario; escuchar; y anotar preguntas para el abogado.",
          "Los ayudantes que no son abogados no pueden: decir qué debe hacer alguien; predecir un resultado; elegir una opción legal por alguien; ni llenar una respuesta legal por esa persona.",
          "Una buena respuesta cuando alguien pregunta qué hacer: \"Eso es una pregunta para el abogado voluntario. Se la voy a anotar, y puedo ayudarle a reunir los papeles que va a necesitar.\"",
          "Una nota de un ayudante que no es abogado va primero al equipo del caso. Llega a la persona solo después de que el abogado supervisor la apruebe.",
          "Nunca llame abogado a la herramienta ni a un ayudante, y nunca la describa como si lo fuera.",
        ],
      },
    },
    {
      id: "conflicts",
      title: { en: "3. Conflicts: say it early", es: "3. Conflictos: dígalo temprano" },
      paras: {
        en: [
          "A conflict is when your own interests or relationships could get in the way of helping a person fairly.",
          "Say so before you look if you know anyone on a case (the person, the other side, a company, a lawyer), if you work for or against them, if you have money or other interests in it, or if you helped someone on a related matter.",
          "You first see a preview with no names: the kind of case, the county, the task. The program checks names for conflicts before any helper sees them.",
          "If you open a case and see a name you know, stop, close the case and tell the program lead. Do not read more and do not talk about it.",
          "Do not take money, gifts or favors from the person you help, and do not promise anything about the result.",
          "Never use what you learn in a case for your own business or to sell anything to anyone.",
          "Lawyers: your own professional conflict rules apply too. The program's check does not replace yours.",
        ],
        es: [
          "Un conflicto es cuando sus propios intereses o relaciones podrían impedirle ayudar a una persona con justicia.",
          "Dígalo antes de mirar si conoce a alguien del caso (la persona, la otra parte, una empresa, un abogado), si trabaja para ellos o en su contra, si tiene dinero u otros intereses en el asunto, o si ayudó a alguien en un asunto relacionado.",
          "Primero ve una vista previa sin nombres: el tipo de caso, el condado, la tarea. El programa revisa los nombres para detectar conflictos antes de que un ayudante los vea.",
          "Si abre un caso y ve un nombre que conoce, deténgase, cierre el caso y avise al líder del programa. No lea más y no hable de eso.",
          "No acepte dinero, regalos ni favores de la persona a la que ayuda, y no prometa nada sobre el resultado.",
          "Nunca use lo que aprende en un caso para su propio negocio ni para venderle algo a nadie.",
          "Abogados: también se aplican sus propias reglas profesionales sobre conflictos. La revisión del programa no reemplaza la suya.",
        ],
      },
    },
  ],
};

const Q = (id, module, critical, q, options, answer, why) => ({ id, module, critical, q, options, answer, why });
export const QUESTIONS = [
  Q("q1", "privacy", false,
    { en: "A person sends a photo of a letter. Where may you share it?", es: "Una persona envía la foto de una carta. ¿Dónde puede compartirla?" },
    [{ en: "In a text to a friend who is a lawyer, for a quick look", es: "En un mensaje de texto a un amigo abogado, para que le dé un vistazo" },
     { en: "On your own cloud drive, so you can read it later", es: "En su propia nube, para leerla más tarde" },
     { en: "Only inside the case in the app, with the people on the case", es: "Solo dentro del caso en la aplicación, con las personas del caso" },
     { en: "Online with the name blurred, to ask strangers for help", es: "En internet con el nombre borroso, para pedir ayuda a desconocidos" }], 2,
    { en: "Everything stays inside the case in the app. Papers never go to personal messages, drives or public places.", es: "Todo se queda dentro del caso en la aplicación. Los papeles nunca van a mensajes personales, nubes ni lugares públicos." }),
  Q("q2", "privacy", false,
    { en: "You open a case you were asked to help with. Who can see that you opened it?", es: "Usted abre un caso en el que le pidieron ayudar. ¿Quién puede ver que lo abrió?" },
    [{ en: "Nobody: opening a case is private", es: "Nadie: abrir un caso es privado" },
     { en: "The person whose case it is: your name and the time are written down", es: "La persona dueña del caso: su nombre y la hora quedan anotados" },
     { en: "Only your supervisor", es: "Solo su supervisor" },
     { en: "Only the court", es: "Solo el tribunal" }], 1,
    { en: "The person can see every time someone opens their case. Only open cases you were asked to help with.", es: "La persona puede ver cada vez que alguien abre su caso. Abra solo casos en los que le pidieron ayudar." }),
  Q("q3", "privacy", false,
    { en: "You see a Social Security number on a paper in the case. What do you do with it?", es: "Usted ve un número de Seguro Social en un papel del caso. ¿Qué hace con él?" },
    [{ en: "Copy it into a note so the lawyer has it handy", es: "Lo copia en una nota para que el abogado lo tenga a mano" },
     { en: "Leave it where it is and never copy it into notes or messages", es: "Lo deja donde está y nunca lo copia en notas ni mensajes" },
     { en: "Text it to the lawyer so it is not lost", es: "Se lo envía por mensaje de texto al abogado para que no se pierda" },
     { en: "Email it to yourself to check it later", es: "Se lo envía por correo a sí mismo para revisarlo después" }], 1,
    { en: "Private numbers stay on the paper, inside the case. Do not copy them anywhere else.", es: "Los números privados se quedan en el papel, dentro del caso. No los copie a ningún otro lugar." }),
  Q("q4", "no-advice", true,
    { en: "A person in the case asks you: \"Should I pay this debt?\" What do you say?", es: "Una persona del caso le pregunta: \"¿Debo pagar esta deuda?\" ¿Qué le dice?" },
    [{ en: "\"Yes, pay it. It is a small amount.\"", es: "\"Sí, pague. Es una cantidad pequeña.\"" },
     { en: "\"No, collectors cannot sue after a while.\"", es: "\"No, los cobradores no pueden demandar después de un tiempo.\"" },
     { en: "\"That is a question for the volunteer lawyer. I will write it down for them.\"", es: "\"Eso es una pregunta para el abogado voluntario. Se la voy a anotar.\"" },
     { en: "\"Ask a friend who knows about debts.\"", es: "\"Pregúntele a un amigo que sepa de deudas.\"" }], 2,
    { en: "Telling someone whether to pay is advice. Only a licensed lawyer gives it. You write the question down for the lawyer.", es: "Decirle a alguien si debe pagar es aconsejar. Solo lo hace un abogado con licencia. Usted anota la pregunta para el abogado." }),
  Q("q5", "no-advice", true,
    { en: "Which of these may a helper who is not a lawyer do?", es: "¿Cuál de estas cosas puede hacer un ayudante que no es abogado?" },
    [{ en: "Tell the person which defense to use", es: "Decirle a la persona qué defensa usar" },
     { en: "Predict how the judge will rule", es: "Predecir cómo va a decidir el juez" },
     { en: "Decide for the person whether to settle", es: "Decidir por la persona si llega a un acuerdo" },
     { en: "Put the papers in date order and point out the dates written on them", es: "Poner los papeles en orden de fechas y señalar las fechas escritas en ellos" }], 3,
    { en: "Organizing papers and pointing to what is written on them is fine. Choosing, predicting and deciding are advice.", es: "Organizar papeles y señalar lo que está escrito en ellos está bien. Elegir, predecir y decidir es aconsejar." }),
  Q("q6", "no-advice", true,
    { en: "What does the AI tool in the app do?", es: "¿Qué hace la herramienta de IA de la aplicación?" },
    [{ en: "Tells a person whether they will win", es: "Le dice a la persona si va a ganar" },
     { en: "Organizes and finds facts in the papers; it never gives legal advice, and its answers are checked against the papers", es: "Organiza y encuentra datos en los papeles; nunca da consejo legal, y sus respuestas se revisan con los papeles" },
     { en: "Acts as a lawyer for people who do not have one", es: "Actúa como abogado de las personas que no tienen uno" },
     { en: "Sends letters to the other side for the person", es: "Envía cartas a la otra parte en nombre de la persona" }], 1,
    { en: "The AI organizes and finds. It does not advise, and it is not a lawyer.", es: "La IA organiza y encuentra. No aconseja, y no es un abogado." }),
  Q("q7", "no-advice", false,
    { en: "You write a note on a case, and you are not a lawyer. Who sees it first?", es: "Usted escribe una nota en un caso, y no es abogado. ¿Quién la ve primero?" },
    [{ en: "The person, right away", es: "La persona, de inmediato" },
     { en: "The case team; it reaches the person only after the supervising lawyer approves it", es: "El equipo del caso; llega a la persona solo después de que el abogado supervisor la apruebe" },
     { en: "Everyone in the program", es: "Todos en el programa" },
     { en: "Nobody: notes are never shared", es: "Nadie: las notas nunca se comparten" }], 1,
    { en: "This keeps advice coming only from a lawyer.", es: "Así el consejo viene solo de un abogado." }),
  Q("q8", "conflicts", false,
    { en: "You open a case and see that the other side is your cousin's company. What do you do?", es: "Usted abre un caso y ve que la otra parte es la empresa de su primo. ¿Qué hace?" },
    [{ en: "Keep reading, to see whether it matters", es: "Sigue leyendo, para ver si importa" },
     { en: "Stop, close the case and tell the program lead before reading more", es: "Se detiene, cierra el caso y avisa al líder del programa antes de leer más" },
     { en: "Tell your cousin so they are ready", es: "Le avisa a su primo para que esté preparado" },
     { en: "Finish your task and mention it later", es: "Termina su tarea y lo menciona después" }], 1,
    { en: "Stop early and say so. Do not read more and do not talk about it with anyone else.", es: "Deténgase pronto y dígalo. No lea más y no hable de eso con nadie más." }),
  Q("q9", "conflicts", false,
    { en: "From a person's papers, you learn something that would help your own business. What do you do with it?", es: "En los papeles de una persona usted se entera de algo que ayudaría a su propio negocio. ¿Qué hace con eso?" },
    [{ en: "Use it, because the papers are only for the program", es: "Lo usa, porque los papeles son solo para el programa" },
     { en: "Mention it to a client of yours, but without a name", es: "Se lo menciona a un cliente suyo, pero sin nombre" },
     { en: "Never use it for your own business or to sell anything", es: "Nunca lo usa para su propio negocio ni para vender nada" },
     { en: "Use it only after the case is closed", es: "Lo usa solo después de que el caso se cierre" }], 2,
    { en: "What you learn in a case is never used for your own business or to sell anything, before or after the case closes.", es: "Lo que usted aprende en un caso nunca se usa para su propio negocio ni para vender nada, ni antes ni después de que el caso se cierre." }),
  Q("q10", "privacy", false,
    { en: "A person in a case says they are thinking of hurting themselves. What do you do?", es: "Una persona de un caso dice que está pensando en hacerse daño. ¿Qué hace?" },
    [{ en: "Tell them to calm down and go back to the papers", es: "Le dice que se calme y vuelve a los papeles" },
     { en: "Wait until the lawyer reads your note", es: "Espera hasta que el abogado lea su nota" },
     { en: "Tell them it will be fine and that they will win", es: "Le dice que todo saldrá bien y que va a ganar" },
     { en: "In an emergency call 911; in a mental-health crisis call or text 988; then tell the program lead", es: "En una emergencia llama al 911; en una crisis de salud mental llama o envía un mensaje de texto al 988; luego avisa al líder del programa" }], 3,
    { en: "A person's safety comes first: 911 for an emergency, 988 for a mental-health or suicide crisis. Then tell the program lead.", es: "Primero está la seguridad de la persona: 911 en una emergencia, 988 en una crisis de salud mental o de suicidio. Luego avise al líder del programa." }),
];

// Scores a set of answers: { questionId: chosen option index }. Pass: at least 8 of 10 and every no-advice question right.
export function scoreQuiz(answers) {
  const a = answers || {}, wrong = [];
  for (const q of QUESTIONS) if (!(Number.isInteger(a[q.id]) && a[q.id] === q.answer)) wrong.push(q.id);
  const criticalWrong = QUESTIONS.some(q => q.critical && wrong.includes(q.id));
  const score = QUESTIONS.length - wrong.length;
  return { score, total: QUESTIONS.length, passed: score >= TRAINING.pass.correct && !criticalWrong, wrong, criticalWrong };
}

// What the page gets: the text and the questions, with no answers and no explanations.
export function publicTraining() {
  return {
    version: TRAINING.version, draft: TRAINING.draft, minutes: TRAINING.minutes, pass: TRAINING.pass, draftNotice: TRAINING.draftNotice, modules: TRAINING.modules,
    questions: QUESTIONS.map(q => ({ id: q.id, module: q.module, critical: q.critical, q: q.q, options: q.options })),
  };
}
