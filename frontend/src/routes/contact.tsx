import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Github } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Nav, Footer } from "@/components/nav";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact - InternPilot" },
      {
        name: "description",
        content: "Get in touch with the InternPilot team.",
      },
    ],
  }),
  component: ContactPage,
});

const PEOPLE = [
  {
    name: "Om Pandya",
    email: "ompandya1234q@gmail.com",
    github: "Om-5640",
    githubUrl: "https://github.com/Om-5640",
  },
  {
    name: "Jhanvi Barot",
    email: "jbarot945@gmail.com",
    github: "JhanviBarot",
    githubUrl: "https://github.com/JhanviBarot",
  },
];

function ContactPage() {
  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-2xl px-6 pt-20 pb-40">

        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to InternPilot
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="mt-12"
        >
          <h1 className="font-display text-4xl sm:text-5xl font-medium tracking-tight">
            Get in touch
          </h1>
          <p className="mt-5 text-base md:text-[17px] leading-relaxed text-muted-foreground">
            InternPilot was built at the DAU AI Club Buildathon. If you have
            questions, ideas, or just want to say hi - reach out to either of us
            directly.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.18, duration: 0.5 }}
          className="mt-14 h-px w-full"
          style={{ background: "var(--color-hairline)" }}
        />

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {PEOPLE.map((person, i) => (
            <motion.div
              key={person.email}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 + i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border p-6 flex flex-col gap-5"
              style={{ borderColor: "var(--color-hairline)" }}
            >
              <div>
                <div className="font-display text-lg font-semibold">{person.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">Co-builder</div>
              </div>

              <div className="flex flex-col gap-3 text-sm">
                <a
                  href={`mailto:${person.email}`}
                  className="flex items-center gap-2.5 text-muted-foreground hover:text-foreground transition-colors group"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full border shrink-0 group-hover:border-primary/40 transition-colors"
                        style={{ borderColor: "var(--color-hairline)" }}>
                    <Mail className="h-3.5 w-3.5" />
                  </span>
                  <span className="break-all">{person.email}</span>
                </a>

                <a
                  href={person.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-muted-foreground hover:text-foreground transition-colors group"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full border shrink-0 group-hover:border-primary/40 transition-colors"
                        style={{ borderColor: "var(--color-hairline)" }}>
                    <Github className="h-3.5 w-3.5" />
                  </span>
                  <span>@{person.github}</span>
                </a>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          className="mt-14 rounded-2xl border p-6 text-sm text-muted-foreground leading-relaxed"
          style={{ borderColor: "var(--color-hairline)" }}
        >
          <span className="font-medium text-foreground">InternPilot</span> is an open project. The full
          source is at{" "}
          <a
            href="https://github.com/Om-5640/InternPilot"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            github.com/Om-5640/InternPilot
          </a>
          . Bug reports, pull requests, and feedback are all welcome.
        </motion.div>

      </main>
      <Footer />
    </div>
  );
}
