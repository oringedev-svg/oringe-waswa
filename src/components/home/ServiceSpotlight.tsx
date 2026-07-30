// The opening statement, centred. No frame of its own: the only rule in this
// stretch of the page is the single vertical line that starts here and runs
// unbroken down into the capability grid, drawn by ScrollThread.
//
// This was a scroll-pinned band cycling three statements over a photo, with
// the proof figures pinned beneath. The statements said the same thing three
// ways, and the figures have moved onto the Case Record strip so a number
// sits beside the cases that produced it.
//
// Not a client component: the line is driven entirely by a CSS variable set
// on an ancestor, so there is nothing here that needs the browser.
export default function ServiceSpotlight() {
  return (
    <section className="spotlight-plain section-ghost-photo">
      <div className="container">
        <div className="statement">
          <h2 className="statement-title">
            Your Matter,
            <br />
            Carried End to End
          </h2>
          <p className="statement-text">
            From the first conversation to the final ruling, every matter is handled by
            advocates who know its detail. We take on litigation, conveyancing, corporate
            and employment work across Kenya, and we tell you plainly where a case stands
            and what it will take to move it.
          </p>
        </div>
      </div>
    </section>
  )
}
