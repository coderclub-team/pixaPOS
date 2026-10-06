const STRIP = ["QSR Counters", "Cloud Kitchens", "Dine-in Restaurants", "Cafés", "Food Courts"];

export default function Clients() {
  return (
    <section className="bg-white pt-20 pb-[70px] lg:pt-[120px] dark:bg-dark">
      <div className="container">
        <p className="mb-8 text-center text-base font-medium text-body-color dark:text-dark-6">
          Built for every kind of food business
        </p>
        <div className="-mx-4 flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
          {STRIP.map((name) => (
            <span
              key={name}
              className="text-xl font-bold whitespace-nowrap text-dark/40 dark:text-white/40"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
