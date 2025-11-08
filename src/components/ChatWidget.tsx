import { useState, useEffect, useRef } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
// CRÍTICO: Importación de Course y courses como named exports.
import { courses, Course } from './CoursesSection';
import './ChatWidget.css';

interface ChatWidgetProps {
  user: {
    nombre: string;
    email: string;
    carrera: string;
  };
}

interface ChatMessage {
  text: string;
  sender: 'user' | 'bot';
  isCourseRecommendation?: boolean;
  courseData?: Course;
  aiReason?: string;
}

export default function ChatWidget({ user }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { text: '¡Hola! 👋 Soy tu asistente laboral de Crece +Perú. Estoy aquí para ayudarte a impulsar tu carrera. ¿En qué te puedo apoyar hoy?', sender: 'bot' }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatBoxRef = useRef<HTMLDivElement>(null);

  // CRÍTICO: Clave de API hardcodeada según tu solicitud.
  // En un entorno de producción, se recomienda encarecidamente usar variables de entorno o un servicio de gestión de secretos.
  const API_KEY = 'AIzaSyD-QphuQjOpaya-r4PHfm-gs8N-okVqun4';

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  const appendMessage = (message: ChatMessage) => {
    setMessages((prevMessages) => [...prevMessages, message]);
  };

  const handleCourseClick = (courseId: string) => {
    alert(`¡Excelente elección! Te has interesado en el curso con ID: ${courseId}. Aquí iría la navegación a la página de detalles del curso.`);
    // Aquí podrías redirigir a una página de detalles del curso, por ejemplo:
    // window.location.href = `/cursos/${courseId}`;
  };

  const sendMessage = async () => {
    const text = userInput.trim();
    if (!text || isLoading) return;

    appendMessage({ text, sender: 'user' });
    setUserInput('');
    setIsLoading(true);

    try {
      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const jobRelatedKeywords = ['trabajo', 'empleo', 'currículum', 'cv', 'postular', 'entrevista', 'buscar trabajo', 'linkedin', 'asesoría', 'asesoria', 'consejo', 'ayuda laboral', 'no encuentro trabajo', 'mejorar mi carrera', 'oportunidades', 'crecer profesionalmente'];
      const isJobRelated = jobRelatedKeywords.some((k) => text.toLowerCase().includes(k));

      let prompt;
      if (isJobRelated && user.carrera && user.carrera !== 'Selecciona tu carrera' && user.carrera !== 'Otro...') {
        const availableCourses = courses.filter(c => c.status === 'available');
        const courseListForAI = availableCourses.map(c => `ID: ${c.id}, Título: ${c.title}, Dificultad: ${c.difficulty}, Beneficios: ${c.careerBenefits.join(', ')}`).join('\n');

        prompt = `
Eres un asesor laboral experto y amigable de Crece +Perú. Tu objetivo principal es guiar al usuario hacia los cursos más adecuados de nuestra plataforma para mejorar su empleabilidad.
El usuario tiene la carrera de "${user.carrera}".
El usuario pregunta: "${text}".

Basado en la carrera del usuario y su pregunta, ¿cuál de los siguientes cursos disponibles sería el más relevante para ayudarle a encontrar trabajo o mejorar su situación laboral? Siempre prioriza recomendar un curso de la lista si es posible.

Lista de cursos disponibles:
${courseListForAI}

Responde con el ID del curso más relevante y una breve explicación (máximo 2 oraciones) de por qué ese curso es beneficioso específicamente para alguien en la carrera de "${user.carrera}" que busca mejorar su empleabilidad.
Utiliza el siguiente formato EXACTO para tu respuesta:
RECOMMEND_COURSE: {id: "ID_DEL_CURSO", reason: "EXPLICACION_BREVE_Y_PERSONALIZADA"}

Si no encuentras un curso directamente relevante para la pregunta específica, o si la pregunta no es sobre empleo, ofrece un consejo laboral general y luego sugiere explorar nuestros cursos disponibles para encontrar otras opciones que puedan ser de su interés. En este caso, NO uses el formato RECOMMEND_COURSE.
`;
      } else {
        prompt = `
Eres un asistente laboral de Crece +Perú. Mi especialidad es ofrecerte orientación para tu carrera y recomendarte los cursos de nuestra plataforma que te ayudarán a conseguir tus metas laborales.
Si tu pregunta no está relacionada con el ámbito laboral o con nuestros cursos, te invito a reformularla para que pueda ofrecerte la mejor ayuda.
Responde de manera concisa y útil, siempre enfocándote en cómo Crece +Perú puede apoyar su desarrollo profesional.

Usuario: ${text}
Respuesta:`;
      }

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      // Intentar parsear la respuesta para una recomendación de curso
      const courseRecommendationMatch = responseText.match(/RECOMMEND_COURSE: \{id: "(.*?)", reason: "(.*?)"\}/);

      if (courseRecommendationMatch && courseRecommendationMatch.length === 3) {
        const courseId = courseRecommendationMatch[1];
        const aiReason = courseRecommendationMatch[2];
        const recommendedCourse = courses.find(c => c.id === courseId);

        if (recommendedCourse) {
          appendMessage({
            text: `¡Claro! Basado en tu carrera de ${user.carrera}, te recomiendo este curso:`,
            sender: 'bot',
            isCourseRecommendation: true,
            courseData: recommendedCourse,
            aiReason: aiReason,
          });
        } else {
          // Fallback si el ID del curso no se encuentra, pero el formato sí
          appendMessage({ text: `No pude encontrar el curso con ID "${courseId}" en nuestra lista, pero te ofrezco este consejo: ${aiReason} Te invito a explorar nuestros cursos disponibles para encontrar la mejor opción para ti.`, sender: 'bot' });
        }
      } else {
        // Si no es una recomendación de curso o el formato no coincide
        appendMessage({ text: responseText, sender: 'bot' });
      }

    } catch (err) {
      console.error('Error al comunicarse con el asistente de Crece +Perú:', err);
      appendMessage({ text: '⚠️ Ocurrió un error al procesar tu mensaje. Por favor, inténtalo de nuevo más tarde.', sender: 'bot' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="chat-widget-container">
      <div className={`chat-window ${isOpen ? 'open' : ''}`}>
        <div className="chat-header">
          <h3>🤖 Asistente Laboral Crece +Perú</h3>
          <button onClick={toggleChat} className="close-chat-btn">&times;</button>
        </div>
        <div className="chat-box" id="chatBox" ref={chatBoxRef}>
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.sender === 'user' ? 'user-msg' : 'bot-msg'}`}>
              {msg.isCourseRecommendation && msg.courseData ? (
                <div className="course-recommendation-card" onClick={() => handleCourseClick(msg.courseData!.id)}>
                  <img src={msg.courseData.imageUrl} alt={msg.courseData.title} className="course-rec-image" />
                  <div className="course-rec-content">
                    <h4>{msg.courseData.title}</h4>
                    <p className="course-rec-difficulty">Dificultad: <span>{msg.courseData.difficulty}</span></p>
                    <p className="course-rec-reason">{msg.aiReason}</p>
                    <button className="course-rec-button">Ver Curso</button>
                  </div>
                </div>
              ) : (
                msg.text
              )}
            </div>
          ))}
        </div>
        <div className="chat-input">
          <textarea
            id="userInput"
            rows={1}
            placeholder="Escribe tu mensaje..."
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          ></textarea>
          <button id="sendBtn" onClick={sendMessage} disabled={isLoading}>
            Enviar
          </button>
        </div>
      </div>
      <button onClick={toggleChat} className="chat-bubble">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
          <path d="M12 2C6.486 2 2 5.589 2 10c0 2.908 1.897 5.515 5 6.934V22l5.34-4.005C17.044 17.587 22 14.258 22 10c0-4.411-4.486-8-10-8zm0 14h-.051c-1.262.022-4.132 1.231-4.949 1.867V16.58c.021-.016.042-.032.063-.048.005-.004.01-.007.015-.011A7.95 7.95 0 0 1 4 10c0-3.309 3.589-6 8-6s8 2.691 8 6-3.589 6-8 6z"/>
          <path d="M9.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm5 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>
        </svg>
      </button>
    </div>
  );
}
