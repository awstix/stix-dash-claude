export function calculateProjectPerformance({
  changeOrdersNet,
  contractValueNet,
  paymentsNet,
  progressPercent,
}: {
  changeOrdersNet: number;
  contractValueNet: number;
  paymentsNet: number;
  progressPercent: number;
}) {
  const totalContract = contractValueNet + changeOrdersNet;
  const performanceValue = totalContract * (progressPercent / 100);
  const billingPercent = totalContract > 0 ? (paymentsNet / totalContract) * 100 : 0;

  // Positiv = Überdeckung, Negativ = Unterdeckung
  const difference = paymentsNet - performanceValue;
  const coveragePercent = performanceValue > 0 ? (difference / performanceValue) * 100 : 0;

  return {
    billingPercent,
    coveragePercent,
    difference,
    performanceValue,
    totalContract,
  };
}
