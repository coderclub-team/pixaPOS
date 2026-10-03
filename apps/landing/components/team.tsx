import SectionTitle from "@/components/section-title";

const TEAM = [
  { name: "Adveen Desuza", designation: "UI Designer" },
  { name: "Jezmin uniya", designation: "Product Designer" },
  { name: "Andrieo Gloree", designation: "App Developer" },
  { name: "Jackie Sanders", designation: "Content Writer" },
];

export default function Team() {
  return (
    <section
      id="team"
      className="overflow-hidden bg-gray-1 pt-20 pb-12 lg:pt-[120px] lg:pb-[90px] dark:bg-dark-2"
    >
      <div className="container">
        <div className="mb-[60px]">
          <SectionTitle
            subtitle="Our Team"
            title="Meet Our Team"
            paragraph="There are many variations of passages of Lorem Ipsum available but the majority have suffered alteration in some form."
            width="640px"
            center
          />
        </div>

        <div className="-mx-4 flex flex-wrap justify-center">
          {TEAM.map((team) => (
            <div key={team.name} className="w-full px-4 sm:w-1/2 lg:w-1/4 xl:w-1/4">
              <div className="group mb-8 rounded-xl bg-white px-5 pt-12 pb-10 shadow-testimonial dark:bg-dark dark:shadow-none">
                <div className="relative z-10 mx-auto mb-5 h-[120px] w-[120px]">
                  <span className="flex h-full w-full items-center justify-center rounded-full bg-primary text-4xl font-bold text-white">
                    {team.name.charAt(0)}
                  </span>
                  <span className="absolute bottom-0 left-0 -z-10 h-10 w-10 rounded-full bg-secondary opacity-0 transition-all group-hover:opacity-100" />
                </div>
                <div className="text-center">
                  <h3 className="mb-1 text-lg font-semibold text-dark dark:text-white">
                    {team.name}
                  </h3>
                  <p className="text-sm text-body-color dark:text-dark-6">{team.designation}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
