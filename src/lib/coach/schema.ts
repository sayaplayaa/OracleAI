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
        "ОДНО предложение на русском: решение или привычка, которая к этому привела, - своими словами по проверенной причине №1 этой фазы и с её временем или числом. Если фаза выиграна - хорошая привычка, которая помогла, тоже с опорой на факт.",
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

// The hero guide for one role. Items and abilities are picked from enums of
// the role's real build and the hero's real kit, so the model can't rename
// one or bring one in from memory; it writes why and when.
export function buildHeroGuideTool(args: {
  earlyItems: string[];
  coreItems: string[];
  lateItems: string[];
  abilities: string[];
  // The skill build was read from replays, so there's something to explain.
  hasSkillBuild: boolean;
}) {
  const { earlyItems, coreItems, lateItems, abilities, hasSkillBuild } = args;
  const NO_ABILITY = "—";
  const earlyItemTips = {
    type: "array",
    items: {
      type: "object",
      properties: {
        item: { type: "string", enum: earlyItems, description: "Предмет линии - ровно как в списке." },
        why: {
          type: "string",
          description:
            "1-2 предложения на русском: зачем он этому герою на линии и когда брать его, а когда альтернативу из данных (против какой линии, после какой минуты).",
        },
      },
      required: ["item", "why"],
      additionalProperties: false,
    },
    minItems: Math.min(1, earlyItems.length),
    maxItems: Math.min(3, earlyItems.length),
    description: "Главные предметы линии: зачем каждый и чем его заменить.",
  };
  const skillTips = {
    type: "array",
    items: findingSchema,
    minItems: 1,
    maxItems: 3,
    description:
      "Почему прокачка из разбора игр именно такая: что даёт способность на этом уровне, когда отходят от обычного порядка. Не меняй порядок из данных; в metric - уровни и доля игр из разбора.",
  };
  const itemTips = {
    type: "array",
    items: {
      type: "object",
      properties: {
        item: { type: "string", enum: coreItems, description: "Предмет основы сборки - ровно как в списке." },
        ability: {
          type: "string",
          enum: [...abilities, NO_ABILITY],
          description: `Способность героя, которую предмет усиливает сильнее всего; «${NO_ABILITY}», если ни одну.`,
        },
        why: {
          type: "string",
          description:
            "1-2 предложения на русском: что меняет предмет именно у этого героя - как он работает вместе с этой способностью или какую слабость героя закрывает. По описанию предмета и способности из данных, без общих слов.",
        },
        whatToDo: {
          type: "string",
          description:
            "1 предложение на русском: что делать сразу после покупки (куда идти, кого ловить, когда драться) и к какой минуте его нужно успеть собрать - по таймингу из данных.",
        },
      },
      required: ["item", "ability", "why", "whatToDo"],
      additionalProperties: false,
    },
    minItems: Math.min(2, coreItems.length),
    maxItems: Math.min(5, coreItems.length),
    description: "Основа сборки в её порядке.",
  };
  const lateItemTips = {
    type: "array",
    items: {
      type: "object",
      properties: {
        item: { type: "string", enum: lateItems, description: "Предмет «по ситуации» - ровно как в списке." },
        when: {
          type: "string",
          description:
            "1 предложение на русском: в какой игре брать именно его - против каких героев или способностей противника. Опирайся на «разбор игр» у предмета (что было у врагов, когда его брали); если разбора нет - на описание предмета.",
        },
      },
      required: ["item", "when"],
      additionalProperties: false,
    },
    minItems: Math.min(2, lateItems.length),
    maxItems: Math.min(4, lateItems.length),
    description: "Поздние варианты и ситуативные предметы: когда какой брать.",
  };
  const tricks = {
    type: "array",
    items: {
      type: "object",
      properties: {
        ability: { type: "string", enum: abilities, description: "Способность, на которой строится приём." },
        trick: {
          type: "string",
          description:
            "1-2 предложения на русском: неочевидный приём на этом герое - из примечания к способности, улучшения Aghanim's или сочетания способности с предметом сборки. Что именно сделать и что это даёт.",
        },
      },
      required: ["ability", "trick"],
      additionalProperties: false,
    },
    minItems: 2,
    maxItems: 4,
    description: "Фишки героя, которые знают сильные игроки и не знают новички.",
  };
  return {
    name: "submit_hero_guide",
    description:
      "Отправить гайд по герою Dota 2 на русском языке для одной роли. Каждый совет - про этого героя: его способность, предмет из его сборки или конкретного противника.",
    input_schema: {
      type: "object" as const,
      properties: {
        identity: {
          type: "string",
          description:
            "2-3 предложения на русском: план игры на этом герое в этой роли - на чём строится сила, к какой минуте и какому предмету герой становится опасен, выгодна ли ему долгая игра (по данным о длине игры).",
        },
        ...(earlyItems.length > 0 ? { earlyItems: earlyItemTips } : {}),
        ...(coreItems.length > 0 ? { itemTips } : {}),
        ...(lateItems.length > 0 ? { lateItems: lateItemTips } : {}),
        ...(hasSkillBuild ? { skillTips } : {}),
        tricks,
        laningTips: {
          type: "array",
          items: findingSchema,
          minItems: 2,
          maxItems: 3,
          description:
            "Как стоять линию именно на этом герое: какую способность когда использовать, как размениваться, что меняет 6 уровень. Каждый пункт называет способность или предмет.",
        },
        teamfightTips: {
          type: "array",
          items: findingSchema,
          minItems: 2,
          maxItems: 3,
          description:
            "Как этот герой входит в драку и что в ней делает: порядок способностей и предметов, кого бить. Каждый пункт называет способность или предмет.",
        },
        matchupTips: {
          type: "array",
          items: findingSchema,
          minItems: 2,
          maxItems: 4,
          description:
            "Что делать против самых неудобных противников и как давить удобных: через опасные способности противника из данных и свои способности и предметы; в metric - винрейт.",
        },
      },
      required: [
        "identity",
        ...(coreItems.length > 0 ? ["itemTips"] : []),
        ...(earlyItems.length > 0 ? ["earlyItems"] : []),
        ...(lateItems.length > 0 ? ["lateItems"] : []),
        ...(hasSkillBuild ? ["skillTips"] : []),
        "tricks",
        "laningTips",
        "teamfightTips",
        "matchupTips",
      ],
      additionalProperties: false,
    },
  };
}

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
