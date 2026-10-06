import SectionTitle from "@/components/site/section-title";
import SingleTeam from "@/components/site/single-team";

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
            paragraph="We build practical restaurant software for operators who need speed, accountability, and dependable day-to-day execution."
            width="640px"
            center
          />
        </div>

        <div className="-mx-4 flex flex-wrap justify-center">
          {TEAM.map((team, i) => (
            <SingleTeam key={i} team={team} />
          ))}
        </div>
      </div>
    </section>
  );
}
