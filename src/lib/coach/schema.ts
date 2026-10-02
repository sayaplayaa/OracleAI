// JSON schema for the forced tool-use call that produces a CoachReport.
// Every finding must carry the specific metric value that grounds it, so the
// model can't hand-wave a claim without pointing at real match/profile data.
// Field descriptions are part of what the model reads while generating, so
// they're in Russian and repeat that every text field is written in Russian.

export const findingSchema = {
  type: "object",
  properties: {
    point: {
      type: "string",
      description:
        "Сам вывод или совет тренера полным предложением на русском. Не название показателя (не «avgKda», не «Золото в минуту»).",
    },
    metric: {
      type: "string",
      description:
        "Показатель из данных, на котором основан пункт, по-русски и с точным числом из данных (например: «Золото в минуту N против M у соперника», где N и M - числа из данных). Не добавляй чисел, перцентилей и сравнений, которых нет в данных.",
    },
  },
  required: ["point", "metric"],
  additionalProperties: false,
};

export const coachReportTool = {
  name: "submit_coaching_report",
  description:
    "Отправить структурированный отчёт тренера по Dota 2 на русском языке. Каждая сильная сторона, слабость и совет должны ссылаться на конкретный показатель из данных.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "string",
        description: "Обзор игры в 2-3 предложениях на русском, основанный на данных.",
      },
      strengths: {
        type: "array",
        items: findingSchema,
        maxItems: 4,
        description: "Что игрок сделал хорошо, каждый пункт подкреплён показателем.",
      },
      weaknesses: {
        type: "array",
        items: findingSchema,
        maxItems: 4,
        description: "Что мешало игроку, каждый пункт подкреплён показателем.",
      },
      tips: {
        type: "array",
        items: findingSchema,
        maxItems: 4,
        description: "Конкретные выполнимые советы, связанные с найденными слабостями.",
      },
    },
    required: ["summary", "strengths", "weaknesses", "tips"],
    additionalProperties: false,
  },
};

const phaseNarrativeSchema = (phaseIds: string[]) => ({
  type: "object",
  properties: {
    phase: {
      type: "string",
      enum: phaseIds,
      description: "id фазы, к которой относится запись (как в заголовке фазы).",
    },
    whatWentWrong: {
      type: "string",
      description:
        "1-2 предложения на русском: что произошло в этой фазе, с точными числами и временем из фактов. Если фаза выиграна - что сработало.",
    },
    decision: {
      type: "string",
      description:
        "ОДНО предложение на русском: решение или привычка, которая к этому привела, с опорой на конкретное время или число из фактов этой фазы (например: «Смерти в 12:06 и 12:46 вне тимфайтов показывают, что ты ходил по карте один без обзора»). Если фаза выиграна - хорошая привычка, которая помогла, тоже с опорой на факт.",
    },
    doInstead: {
      type: "string",
      description:
        "Не больше 2 предложений на русском: что делать иначе в следующей игре, конкретно для роли этого игрока и этой фазы.",
    },
  },
  required: ["phase", "whatWentWrong", "decision", "doInstead"],
  additionalProperties: false,
});

// The single-match report. When the match has a parsed timeline the model
// writes only the summary and one narrative entry per game phase reached -
// strengths and next-game priorities are worked out in code from verified
// causes. Without a timeline there are no phases, so it also writes those.
export function buildMatchCoachReportTool(phaseIds: string[]) {
  const phaseCount = phaseIds.length;
  const summary = {
    type: "string",
    description:
      "2-3 предложения на русском, обращённые к игроку на «ты»: что решило эту игру и в какой фазе. Без перечисления статистики.",
  };

  const properties =
    phaseCount > 0
      ? {
          summary,
          phases: {
            type: "array",
            items: phaseNarrativeSchema(phaseIds),
            minItems: phaseCount,
            maxItems: phaseCount,
            description: "Одна запись на каждую фазу, в хронологическом порядке.",
          },
        }
      : {
          summary,
          strengths: {
            type: "array",
            items: findingSchema,
            maxItems: 3,
            description:
              "Что игрок сделал хорошо для своей роли, каждый пункт подкреплён фактом из данных. Пусто, если ничего не выделялось.",
          },
          tips: {
            type: "array",
            items: findingSchema,
            minItems: 1,
            maxItems: 3,
            description: "Самое важное, что изменить в следующей игре, каждый пункт подкреплён фактом из данных.",
          },
        };

  return {
    name: "submit_match_coaching_report",
    description:
      "Отправить отчёт тренера по Dota 2 на русском языке по одному реальному матчу - по фазам (что пошло не так, какое решение к этому привело, что делать иначе), если есть разбор реплея, - используя только данные факты.",
    input_schema: {
      type: "object" as const,
      properties,
      required: phaseCount > 0 ? ["summary", "phases"] : ["summary", "strengths", "tips"],
      additionalProperties: false,
    },
  };
}

export const heroGuideTool = {
  name: "submit_hero_guide",
  description:
    "Отправить структурированный гайд по герою Dota 2 на русском языке. Каждый совет должен ссылаться на реальную способность/эффект или реальный показатель из данных - никаких выдуманных знаний о герое.",
  input_schema: {
    type: "object" as const,
    properties: {
      identity: {
        type: "string",
        description:
          "2-3 предложения на русском о роли и стиле героя, основанные на его реальном наборе способностей.",
      },
      laningTips: {
        type: "array",
        items: findingSchema,
        minItems: 2,
        maxItems: 4,
        description: "Как играть линию на этом герое, каждый пункт основан на реальной способности или стартовом предмете.",
      },
      powerSpikeTips: {
        type: "array",
        items: findingSchema,
        minItems: 2,
        maxItems: 4,
        description: "Реальные пики силы по предметам/уровням, вокруг которых стоит играть, каждый со ссылкой на конкретный предмет или тайминг.",
      },
      teamfightTips: {
        type: "array",
        items: findingSchema,
        minItems: 2,
        maxItems: 4,
        description: "Как использовать способности героя в тимфайтах, каждый пункт со ссылкой на конкретный эффект способности.",
      },
      matchupTips: {
        type: "array",
        items: findingSchema,
        minItems: 3,
        maxItems: 5,
        description: "Что делать против реально сложных/удобных соперников, каждый пункт с винрейтом матчапа.",
      },
    },
    required: ["identity", "laningTips", "powerSpikeTips", "teamfightTips", "matchupTips"],
    additionalProperties: false,
  },
};

const powerSpikeMomentSchema = {
  type: "object",
  properties: {
    trigger: {
      type: "string",
      description:
        "Реальный предмет, уровень или способность, создающие пик силы, - название точно как в данных (например: «Battle Fury» или «Reincarnation, ранг 1»).",
    },
    timing: {
      type: "string",
      description:
        "Реальное (или приблизительное, с «~») время в этом матче точно как в данных (например: «14:32» или «~9:40»).",
    },
    why: {
      ...findingSchema,
      description:
        "Почему этот триггер - пик силы, со ссылкой на реальный эффект предмета/способности из данных, на русском.",
    },
    whatToDo: {
      ...findingSchema,
      description:
        "Конкретный тактический совет на это окно, на русском: куда идти, какую цель/лагерь/руну забрать, какую драку искать.",
    },
  },
  required: ["trigger", "timing", "why", "whatToDo"],
  additionalProperties: false,
};

export const powerSpikeTool = {
  name: "submit_power_spike_report",
  description:
    "Отправить на русском языке 3-5 реальных пиков силы по реальным покупкам предметов и повышениям уровня игрока в этом матче - никаких выдуманных предметов, уровней или таймингов.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "string",
        description: "1-2 предложения на русском об общей кривой силы героя в этом матче.",
      },
      moments: {
        type: "array",
        items: powerSpikeMomentSchema,
        minItems: 3,
        maxItems: 5,
        description: "3-5 реальных пиков силы в хронологическом порядке.",
      },
    },
    required: ["summary", "moments"],
    additionalProperties: false,
  },
};
