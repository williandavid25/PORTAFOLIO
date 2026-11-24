import Link from "next/link";
import Image from "next/image";
import Loader from "@/components/site/Loader";
import Hero from "@/components/site/Hero";
import Showreel from "@/components/site/Showreel";
import PortfolioGrid from "@/components/site/PortfolioGrid";
import ContactForm from "@/components/site/ContactForm";
import Socials from "@/components/site/Socials";
import Icon from "@/components/site/Icon";
import SectionTitle from "@/components/site/SectionTitle";
import { getProjects, getSite, getTestimonials } from "@/lib/data";
import { mediaUrl } from "@/lib/supabase/config";
import { toCard } from "@/lib/cards";

export const revalidate = 60;

const SERVICES = [
  { icon: "film", title: "Edición para Redes Sociales", text: "Reels, TikToks y Shorts diseñados para detener el scroll y maximizar el engagement de tu audiencia." },
  { icon: "home", title: "Videos Inmobiliarios", text: "Edición en CapCut para asesores inmobiliarios: recorridos de propiedades, reels de captación y anuncios con precio, ubicación, subtítulos dinámicos y música que venden." },
  { icon: "video", title: "Producción Publicitaria", text: "Videos comerciales de alto impacto para campañas digitales que convierten espectadores en clientes." },
  { icon: "monitor", title: "Video Corporativo", text: "Presentaciones institucionales, videos de marca y testimonios que fortalecen la identidad de tu empresa." },
  { icon: "playc", title: "YouTube & Streaming", text: "Edición profesional para creadores: intros, outros, thumbnails animados y motion graphics personalizados." },
  { icon: "pulse", title: "Color & Motion Graphics", text: "Gradación de color cinematográfica, animaciones tipográficas e intros dinámicas que elevan tu contenido." },
  { icon: "code", title: "Desarrollo Web", text: "Páginas web sencillas y landing pages con HTML, CSS y JavaScript, trabajadas en Visual Studio Code y versionadas en GitHub." },
  { icon: "users", title: "Community Management", text: "Gestiono tus redes: calendario de contenido, publicaciones, respuesta a la comunidad y reporte de resultados." },
];

const STEPS = [
  { icon: "doc", title: "Briefing", text: "Entendemos tus objetivos, audiencia y el mensaje a comunicar." },
  { icon: "refresh", title: "Recepción", text: "Recepción y organización de todos los archivos RAW del proyecto." },
  { icon: "film", title: "Edición", text: "Montaje profesional, sincronización y construcción de la narrativa." },
  { icon: "clock", title: "Color & Audio", text: "Gradación de color cinematográfica y mezcla de audio profesional." },
  { icon: "eye", title: "Revisión", text: "Primer corte y ajustes contigo hasta la perfección." },
  { icon: "send", title: "Entrega", text: "Exportación optimizada para cada plataforma y formato." },
];

const PILLARS = [
  {
    icon: "film", title: "Editor de video", lead: "Mi especialidad. Videos con ritmo, color y sonido cuidados para cada plataforma.",
    points: ["Reels, TikToks y Shorts", "Videos inmobiliarios en CapCut", "Publicidad y video corporativo", "Color grading y motion graphics", "Formatos listos para cada red"],
  },
  {
    icon: "code", title: "Programación web", lead: "Nivel básico, enfocado en resultados prácticos para mis clientes y proyectos.",
    points: ["Páginas sencillas con HTML, CSS y JavaScript", "Visual Studio Code", "Control de versiones con Git y GitHub", "Publicación del sitio en la web"],
  },
  {
    icon: "users", title: "Community Manager", lead: "Experiencia gestionando las redes sociales de marcas, de la idea al reporte.",
    points: ["Calendario y estrategia de contenido", "Publicación y programación de posts", "Respuesta y cuidado de la comunidad", "Reporte de métricas y resultados"],
  },
];

const MARQUEE = ["Edición de video", "Videos inmobiliarios", "CapCut", "Desarrollo web", "Community Manager", "Reels", "Motion Graphics", "Color Grading"];

export default async function HomePage() {
  const [site, projects, testimonials] = await Promise.all([getSite(), getProjects(), getTestimonials()]);
  const featured = projects.find((p) => p.featured) ?? projects[0] ?? null;
  const featuredCard = featured ? toCard(featured) : null;
  const latest = projects.slice(0, 6).map(toCard);
  const aboutImg = mediaUrl(site.aboutImagePath);
  const wa = site.whatsapp ? `https://wa.me/${site.whatsapp}` : null;
  const titleWords = site.aboutTitle.split(" ");
  const cut = Math.ceil(titleWords.length / 2);

  return (
    <>
      <Loader />
      <Hero site={site} mediaUrl={mediaUrl(site.heroMediaPath)} reelHref={featured ? `/portafolio/${featured.slug}` : "/#showreel"} />

      <div className="marq" aria-hidden="true">
        <div className="marq-track" data-marquee>
          {[0, 1].map((k) => (
            <div className="marq-row" key={k}>
              {MARQUEE.map((m, i) => (
                <span key={m} style={{ display: "contents" }}>
                  <span className={i % 2 ? "o" : ""}>{m}</span>
                  <span className="sep" aria-hidden="true" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <section className="stats">
        <div className="container">
          <div className="stats-grid">
            <div className="stat" data-reveal><b data-count={site.stats.projects}>{site.stats.projects}</b><span>Proyectos completados</span></div>
            <div className="stat" data-reveal><b data-count={site.stats.clients}>{site.stats.clients}</b><span>Clientes satisfechos</span></div>
            <div className="stat" data-reveal><b data-count={site.stats.years}>{site.stats.years}</b><span>Años de experiencia</span></div>
            <div className="stat" data-reveal><b data-count={site.stats.satisfaction} data-suffix="%">{site.stats.satisfaction}%</b><span>Satisfacción</span></div>
          </div>
        </div>
      </section>

      <section className="section" id="sobre-mi">
        <div className="container about-grid">
          <div className="about-pic" data-crew="drag-left">
            <div className="about-frame">
              {aboutImg ? (
                <Image src={aboutImg} alt={site.name} fill quality={90} sizes="(max-width: 900px) 92vw, 45vw" data-parallax />
              ) : (
                <div className="about-ph"><Icon name="user" size={40} stroke={1.2} /></div>
              )}
            </div>
            <div className="about-tag"><span className="ic"><Icon name="video" /></span><div><b>Edición premium</b>Entrega en 24–72 h</div></div>
          </div>
          <div>
            <SectionTitle main="Sobre mí" script="mi historia" />
            <h3 className="title" style={{ fontSize: "clamp(1.6rem,2.6vw,2.2rem)" }} data-reveal>{titleWords.slice(0, cut).join(" ")} <em>{titleWords.slice(cut).join(" ")}</em></h3>
            <p className="lead" data-reveal>{site.bio}</p>
            <div className="skills" data-reveal>
              {site.skills.map((s) => (
                <div className="skill" key={s.name}>
                  <div className="skill-h"><span>{s.name}</span><span>{s.level}%</span></div>
                  <div className="skill-b"><div className="skill-f" style={{ ["--w" as string]: `${s.level}%` }} data-skill={s.level} /></div>
                </div>
              ))}
            </div>
            <div className="row-btns" data-reveal>
              <Link href="/#contacto" className="btn btn-p" data-magnetic>Trabajemos juntos</Link>
              {site.cvUrl && <a href={site.cvUrl} className="btn btn-o" target="_blank" rel="noopener noreferrer" data-magnetic>Descargar CV</a>}
            </div>
          </div>
        </div>
      </section>

      <section className="section pillars-sec" id="perfil">
        <div className="container">
          <SectionTitle main="Perfil" script="tres en uno" center sub="Edito, programo y gestiono redes: un solo contacto para que tu marca se vea bien, funcione en la web y crezca en redes." />
          <div className="pillars">
            {PILLARS.map((p, i) => (
              <article className="pillar" key={p.title} data-tilt data-crew="stretch">
                <div className="pillar-top"><span className="card-ic"><Icon name={p.icon} size={22} stroke={1.4} /></span><span className="pillar-num">0{i + 1}</span></div>
                <h3>{p.title}</h3>
                <p>{p.lead}</p>
                <ul>{p.points.map((pt) => <li key={pt}>{pt}</li>)}</ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section tools-sec" id="herramientas">
        <div className="container">
          <SectionTitle main="Herramientas" script="con lo que trabajo" center />
          <div className="tools-grid">
            {site.tools.map((g, i) => (
              <div className="tools-card" key={g.group} data-crew="stretch">
                <div className="tools-head"><span className="tools-num">0{i + 1}</span><h3>{g.group}</h3></div>
                <ul className="chips">{g.items.map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section services" id="servicios">
        <div className="container">
          <SectionTitle main="Servicios" script="lo que hago" center />
          <div className="serv-grid">
            {SERVICES.map((s, i) => (
              <article className="card" key={s.title} data-tilt data-crew="stretch">
                <div className="card-ic"><Icon name={s.icon} size={24} stroke={1.5} /></div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
                <span className="num">0{i + 1}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <Showreel project={featuredCard?.project ?? null} videoUrl={featuredCard?.videoUrl ?? null} thumbUrl={featuredCard?.thumbUrl ?? null} />

      <section className="section" id="portafolio">
        <div className="container">
          <div className="pf-head">
            <div>
              <SectionTitle main="Portafolio" script="trabajos selectos" />
            </div>
            <Link href="/portafolio" className="btn btn-o" style={{ marginBottom: 40 }} data-magnetic data-reveal>Ver todo <Icon name="arrow" className="arr" /></Link>
          </div>
          <PortfolioGrid items={latest} showFilters={false} />
        </div>
      </section>

      <section className="section process">
        <div className="container">
          <SectionTitle main="Proceso" script="cómo trabajo" center />
          <div className="steps" data-steps>
            <div className="steps-line"><div className="steps-fill" /></div>
            {STEPS.map((s, i) => (
              <div className="step" key={s.title} data-reveal>
                <div className="step-ic"><Icon name={s.icon} size={26} stroke={1.5} /></div>
                <small>0{i + 1}</small>
                <h4>{s.title}</h4>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="testimonios">
        <div className="container">
          <SectionTitle main="Clientes" script="lo que dicen" center />
          <div className="tgrid">
            {testimonials.length ? (
              testimonials.map((t, i) => {
                const av = mediaUrl(t.avatar_path);
                return (
                  <figure className="tcard" key={t.id} data-tilt data-crew={i % 2 ? "drag-right" : "drag-left"}>
                    <div className="stars" aria-label={`${t.stars} de 5 estrellas`}>{"★".repeat(t.stars)}</div>
                    <div className="q" aria-hidden="true">“</div>
                    <blockquote><p>{t.body}</p></blockquote>
                    <figcaption className="who">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <div className="avatar">{av ? <img src={av} alt="" loading="lazy" /> : t.name.charAt(0)}</div>
                      <div><b>{t.name}</b><span>{t.role}</span></div>
                    </figcaption>
                  </figure>
                );
              })
            ) : (
              <div className="empty" data-reveal>Los testimonios de clientes aparecerán aquí pronto.</div>
            )}
          </div>
        </div>
      </section>

      <section className="section contact" id="contacto">
        <div className="container contact-grid">
          <div>
            <SectionTitle main="Contacto" script="hablemos" />
            <p className="lead" data-reveal>¿Necesitas videos, una página web sencilla o alguien que gestione tus redes? Cuéntame sobre tu proyecto y en menos de 24 horas tendrás una propuesta.</p>
            <div className="clist" data-crew="drag-left">
              {site.email && (
                <a className="citem" href={`mailto:${site.email}`}><span className="ic"><Icon name="mail" /></span><div><small>Email</small><span>{site.email}</span></div></a>
              )}
              {wa && (
                <a className="citem" href={wa} target="_blank" rel="noopener noreferrer"><span className="ic"><Icon name="phone" /></span><div><small>WhatsApp</small><span>+{site.whatsapp}</span></div></a>
              )}
              {site.location && (
                <div className="citem"><span className="ic"><Icon name="pin" /></span><div><small>Ubicación</small><span>{site.location}</span></div></div>
              )}
            </div>
            <div data-reveal><Socials socials={site.socials} /></div>
          </div>
          <div className="form-card" data-crew="select">
            <h3>Envíame un mensaje</h3>
            <ContactForm />
          </div>
        </div>
      </section>
    </>
  );
}
