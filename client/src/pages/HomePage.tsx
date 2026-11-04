import { ButtonLink, Card, Icon } from "../components/ui/index.ts";
import styles from "./HomePage.module.css";

export function HomePage() {
  return <><section className={styles.hero} aria-labelledby="home-heading">
    <div className={styles.intro}><p className={styles.eyebrow}><span /> A little curiosity goes a long way</p>
      <h1 id="home-heading">Small questions.<br /><span>Big discoveries.</span></h1>
      <p className={styles.lead}>A shared space for thoughtful quizzes. Make room for new ideas, one question at a time.</p>
      <div className={styles.actions}><ButtonLink to="/teacher">For teachers <Icon name="arrow" /></ButtonLink><ButtonLink to="/student" variant="dark">For students <Icon name="arrow" /></ButtonLink></div>
      <p className={styles.note}><Icon name="book" /> Built for the classroom. Open to possibility.</p>
    </div>
    <div className={styles.art} aria-hidden="true">
      <div className={styles.artTop}><span className={styles.artDot} /><span>IDEAS TAKE SHAPE</span><Icon name="spark" /></div>
      <svg className={styles.geometry} viewBox="0 0 400 280" fill="none">
        <path className={styles.guides} d="M20 140h360M200 10v260" />
        <rect className={styles.shapeSoft} x="49" y="25" width="136" height="114" rx="20" />
        <path className={styles.shapeGreen} d="M63 128a57 57 0 0 1 114 0H63Z" />
        <circle className={styles.shapeDark} cx="264" cy="82" r="54" />
        <circle className={styles.shapePage} cx="264" cy="82" r="23" />
        <path className={styles.shapeGreen} d="M209 158h104a18 18 0 0 1 18 18v54a18 18 0 0 1-18 18H209v-90Z" />
        <path className={styles.shapeSage} d="M67 228 130 155l63 73H67Z" />
        <path className={styles.line} d="m231 204 19 19 40-44" />
        <path className={styles.spark} d="m350 115 5 13 13 5-13 5-5 13-5-13-13-5 13-5 5-13Z" />
      </svg>
      <div className={styles.artBottom}><span className={styles.artNumber}>01</span><div><strong>Start with a question.</strong><span>See where it takes you.</span></div><span className={styles.artArrow}><Icon name="arrow" /></span></div>
    </div>
  </section>
  <section className={styles.pathSection} aria-labelledby="path-heading"><div className={styles.sectionHeading}><h2 id="path-heading">A good place to begin.</h2><p>Two perspectives. A shared pursuit of understanding.</p></div>
    <div className={styles.paths}><Card className={styles.pathCard}><span className={styles.step}>01 / TEACH</span><Icon name="layers" /><h3>Bring your ideas to class.</h3><p>Give a subject a fresh angle with questions that invite a closer look.</p></Card>
      <Card className={styles.pathCard}><span className={styles.step}>02 / LEARN</span><Icon name="spark" /><h3>Follow your curiosity.</h3><p>Take a moment to think, connect the dots, and find your own way forward.</p></Card></div>
  </section></>;
}
