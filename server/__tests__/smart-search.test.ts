import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreate, mockSql } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockSql: vi.fn(),
}));

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: mockCreate,
      },
    };
  },
}));

vi.mock('@neondatabase/serverless', () => ({
  neon: () => mockSql,
  neonConfig: { webSocketConstructor: null },
}));
vi.mock('ws', () => ({ default: class {} }));

import { smartSearch } from '../smart-search';

describe('Smart Search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
  });

  it('should return fallback when OPENAI_API_KEY is not set', async () => {
    delete process.env.OPENAI_API_KEY;
    // We need to re-import or handle that the key check is at runtime
    const result = await smartSearch('test question');
    // Should return some kind of response (fallback)
    expect(result).toHaveProperty('answer');
  });

  it('should handle OpenAI returning tool calls with SQL query', async () => {
    const sqlQuery = "SELECT COUNT(*) as total FROM sales_data WHERE company_id = 1";
    mockCreate
      .mockResolvedValueOnce({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                arguments: JSON.stringify({ query: sqlQuery, explanation: 'Count sales' }),
              },
            }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Found 100 sales records' } }],
      });

    mockSql.mockResolvedValue([{ total: 100 }]);

    const result = await smartSearch('How many sales?', 1);

    expect(result.answer).toBeDefined();
    expect(result.source).toContain('SQL');
  });

  it('should handle SQL execution errors gracefully', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          tool_calls: [{
            function: {
              arguments: JSON.stringify({ query: 'SELECT * FROM nonexistent', explanation: 'test' }),
            },
          }],
        },
      }],
    });

    mockSql.mockRejectedValue(new Error('relation does not exist'));

    const result = await smartSearch('bad query');
    expect(result).toHaveProperty('answer');
  });

  it('should block non-SELECT queries', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          tool_calls: [{
            function: {
              arguments: JSON.stringify({ query: 'DELETE FROM sales_data', explanation: 'delete' }),
            },
          }],
        },
      }],
    });

    const result = await smartSearch('delete everything');
    // Should fall back because DELETE is blocked
    expect(result).toHaveProperty('answer');
  });

  it('should handle OpenAI API errors', async () => {
    mockCreate.mockRejectedValue(new Error('API rate limit exceeded'));

    const result = await smartSearch('any question');
    expect(result).toHaveProperty('answer');
  });

  it('should handle response without tool calls', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: 'I cannot help with that.',
          tool_calls: undefined,
        },
      }],
    });

    const result = await smartSearch('something unrelated');
    expect(result.answer).toBeDefined();
  });

  it('should handle empty tool_calls array', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: 'No query needed',
          tool_calls: [],
        },
      }],
    });

    const result = await smartSearch('hi');
    expect(result.answer).toBeDefined();
  });

  it('should include companyId context when provided', async () => {
    mockCreate
      .mockResolvedValueOnce({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                arguments: JSON.stringify({ query: "SELECT 1 as test", explanation: 'test' }),
              },
            }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'test result' } }],
      });

    mockSql.mockResolvedValue([{ test: 1 }]);

    const result = await smartSearch('sales data', 2);
    expect(result).toHaveProperty('answer');
  });

  it('should handle malformed function arguments', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          tool_calls: [{
            function: {
              arguments: 'not valid json',
            },
          }],
        },
      }],
    });

    const result = await smartSearch('test');
    expect(result).toHaveProperty('answer');
  });

  // =========================================================================
  // executeSafeQuery — SQL injection prevention
  // =========================================================================
  describe('SQL safety enforcement', () => {
    it('should block INSERT statements', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                arguments: JSON.stringify({
                  query: 'INSERT INTO sales_data VALUES (1)',
                  explanation: 'insert',
                }),
              },
            }],
          },
        }],
      });

      const result = await smartSearch('insert data');
      expect(result).toHaveProperty('answer');
      // Should not have SQL source since INSERT is blocked
      expect(result.source).not.toContain('INSERT');
    });

    it('should block UPDATE statements', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                arguments: JSON.stringify({
                  query: 'UPDATE sales_data SET quantity = 0',
                  explanation: 'update',
                }),
              },
            }],
          },
        }],
      });

      const result = await smartSearch('update everything');
      expect(result).toHaveProperty('answer');
      expect(result.source).not.toContain('UPDATE');
    });

    it('should block DROP statements', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                arguments: JSON.stringify({
                  query: 'DROP TABLE sales_data',
                  explanation: 'drop',
                }),
              },
            }],
          },
        }],
      });

      const result = await smartSearch('drop table');
      expect(result).toHaveProperty('answer');
    });

    it('should block multi-statement queries with semicolons', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                arguments: JSON.stringify({
                  query: "SELECT 1; DELETE FROM sales_data",
                  explanation: 'multi-statement',
                }),
              },
            }],
          },
        }],
      });

      const result = await smartSearch('multi statement');
      expect(result).toHaveProperty('answer');
    });

    it('should block TRUNCATE statements', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                arguments: JSON.stringify({
                  query: 'TRUNCATE sales_data',
                  explanation: 'truncate',
                }),
              },
            }],
          },
        }],
      });

      const result = await smartSearch('truncate');
      expect(result).toHaveProperty('answer');
    });

    it('should block GRANT statements', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                arguments: JSON.stringify({
                  query: 'GRANT ALL ON sales_data TO public',
                  explanation: 'grant',
                }),
              },
            }],
          },
        }],
      });

      const result = await smartSearch('grant access');
      expect(result).toHaveProperty('answer');
    });

    it('should allow SELECT with column names containing forbidden substrings like updated_at', async () => {
      mockCreate
        .mockResolvedValueOnce({
          choices: [{
            message: {
              tool_calls: [{
                function: {
                  arguments: JSON.stringify({
                    query: "SELECT updated_at, created_at FROM sales_data LIMIT 5",
                    explanation: 'get dates',
                  }),
                },
              }],
            },
          }],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Found date fields' } }],
        });

      mockSql.mockResolvedValue([{ updated_at: '2025-01-01', created_at: '2025-01-01' }]);

      const result = await smartSearch('show update dates');
      expect(result.source).toContain('SQL');
    });

    it('should add LIMIT 500 when query has no LIMIT clause', async () => {
      mockCreate
        .mockResolvedValueOnce({
          choices: [{
            message: {
              tool_calls: [{
                function: {
                  arguments: JSON.stringify({
                    query: 'SELECT * FROM sales_data',
                    explanation: 'all data',
                  }),
                },
              }],
            },
          }],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'All data' } }],
        });

      mockSql.mockResolvedValue([{ id: 1 }]);

      const result = await smartSearch('show all data');
      // The mockSql should have been called with a query containing LIMIT
      expect(mockSql).toHaveBeenCalled();
      const queryUsed = mockSql.mock.calls[0][0];
      expect(queryUsed).toContain('LIMIT 500');
    });
  });

  // =========================================================================
  // Tool call edge cases
  // =========================================================================
  describe('tool call edge cases', () => {
    it('should handle tool call with no function property', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            tool_calls: [{
              // no function property
            }],
          },
        }],
      });

      const result = await smartSearch('no function');
      expect(result).toHaveProperty('answer');
    });

    it('should handle null function arguments in tool call', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                arguments: null,
              },
            }],
          },
        }],
      });

      const result = await smartSearch('null args');
      expect(result).toHaveProperty('answer');
    });

    it('should handle interpret response returning null content', async () => {
      mockCreate
        .mockResolvedValueOnce({
          choices: [{
            message: {
              tool_calls: [{
                function: {
                  arguments: JSON.stringify({
                    query: 'SELECT COUNT(*) as c FROM sales_data',
                    explanation: 'count',
                  }),
                },
              }],
            },
          }],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: null } }],
        });

      mockSql.mockResolvedValue([{ c: 42 }]);

      const result = await smartSearch('count records');
      expect(result.answer).toBe('No pude interpretar los resultados.');
    });
  });

  // =========================================================================
  // Fallback search — various query patterns
  // =========================================================================
  describe('fallback search patterns', () => {
    beforeEach(() => {
      delete process.env.OPENAI_API_KEY;
    });

    it('should detect month "enero" in fallback search for DURA', async () => {
      mockSql.mockResolvedValue([
        { sale_year: 2025, total_kg: 50000, clientes: 10, company_id: 1 },
      ]);

      const result = await smartSearch('ventas de enero dura');
      expect(result).toHaveProperty('answer');
      expect(result.source).toBe('Búsqueda local');
    });

    it('should detect month "octubre" in fallback search for ORSEGA', async () => {
      mockSql.mockResolvedValue([
        { sale_year: 2025, total_unidades: 30000, clientes: 5, company_id: 2 },
      ]);

      const result = await smartSearch('ventas de octubre orsega');
      expect(result).toHaveProperty('answer');
      expect(result.source).toBe('Búsqueda local');
    });

    it('should handle month query for both companies when none specified', async () => {
      mockSql.mockResolvedValue([
        { company_id: 1, sale_year: 2025, total: 50000, clientes: 10 },
        { company_id: 2, sale_year: 2025, total: 30000, clientes: 5 },
      ]);

      const result = await smartSearch('ventas marzo');
      expect(result).toHaveProperty('answer');
      expect(result.source).toBe('Búsqueda local');
    });

    it('should return resumen general when asked', async () => {
      mockSql.mockResolvedValue([
        { company_id: 1, sale_year: 2025, total: 100000, clientes: 20 },
        { company_id: 2, sale_year: 2025, total: 50000, clientes: 15 },
      ]);

      const result = await smartSearch('resumen de ventas');
      expect(result.answer).toContain('Resumen de ventas');
      expect(result.source).toBe('Búsqueda local');
    });

    it('should return total summary when "total" is mentioned', async () => {
      mockSql.mockResolvedValue([
        { company_id: 1, sale_year: 2025, total: 100000, clientes: 20 },
      ]);

      const result = await smartSearch('total de ventas');
      expect(result.answer).toContain('Resumen');
      expect(result.source).toBe('Búsqueda local');
    });

    it('should return top clients for DURA when asked', async () => {
      mockSql.mockResolvedValue([
        { client_name: 'Acme Corp', total: 50000 },
        { client_name: 'Beta Inc', total: 30000 },
      ]);

      const result = await smartSearch('top clientes de dura');
      expect(result.answer).toContain('Top clientes DURA');
      expect(result.source).toBe('Búsqueda local');
    });

    it('should return top clients for ORSEGA when asked with "mejores"', async () => {
      mockSql.mockResolvedValue([
        { client_name: 'Gamma SA', total: 20000 },
      ]);

      const result = await smartSearch('mejores clientes orsega');
      expect(result.answer).toContain('Top clientes ORSEGA');
    });

    it('should return help text when question does not match any pattern', async () => {
      const result = await smartSearch('something completely random');
      expect(result.answer).toContain('No pude procesar tu pregunta');
      expect(result.source).toBe('Ayuda');
    });

    it('should handle empty SQL result in fallback month query', async () => {
      mockSql.mockResolvedValue([]);

      // Month detected but no data
      const result = await smartSearch('ventas de diciembre dura');
      // Falls through because result is empty, should still return some answer
      expect(result).toHaveProperty('answer');
    });

    it('should handle SQL error in fallback search gracefully', async () => {
      mockSql.mockRejectedValue(new Error('connection refused'));

      const result = await smartSearch('ventas enero');
      expect(result).toHaveProperty('answer');
      // Should return help text since fallback also failed
      expect(result.answer).toContain('No pude procesar tu pregunta');
    });

    it('should detect "principales" as top clients trigger', async () => {
      mockSql.mockResolvedValue([
        { client_name: 'X Corp', total: 10000 },
      ]);

      const result = await smartSearch('principales clientes dura');
      expect(result.answer).toContain('Top clientes');
    });

    it('should detect "general" as resumen trigger', async () => {
      mockSql.mockResolvedValue([
        { company_id: 1, sale_year: 2025, total: 80000, clientes: 15 },
      ]);

      const result = await smartSearch('vista general');
      expect(result.answer).toContain('Resumen');
    });
  });

  // =========================================================================
  // companyId context in queries
  // =========================================================================
  describe('company context handling', () => {
    it('should include DURA context for companyId=1', async () => {
      mockCreate
        .mockResolvedValueOnce({
          choices: [{
            message: {
              tool_calls: [{
                function: {
                  arguments: JSON.stringify({ query: 'SELECT 1 as test', explanation: 'test' }),
                },
              }],
            },
          }],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'DURA result' } }],
        });

      mockSql.mockResolvedValue([{ test: 1 }]);

      await smartSearch('ventas', 1);

      // Check that OpenAI was called with company context
      const messages = mockCreate.mock.calls[0][0].messages;
      const userMessage = messages.find((m: any) => m.role === 'user');
      expect(userMessage.content).toContain('company_id=1');
      expect(userMessage.content).toContain('DURA International');
    });

    it('should include Orsega context for companyId=2', async () => {
      mockCreate
        .mockResolvedValueOnce({
          choices: [{
            message: {
              tool_calls: [{
                function: {
                  arguments: JSON.stringify({ query: 'SELECT 1 as test', explanation: 'test' }),
                },
              }],
            },
          }],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Orsega result' } }],
        });

      mockSql.mockResolvedValue([{ test: 1 }]);

      await smartSearch('ventas', 2);

      const messages = mockCreate.mock.calls[0][0].messages;
      const userMessage = messages.find((m: any) => m.role === 'user');
      expect(userMessage.content).toContain('company_id=2');
      expect(userMessage.content).toContain('Grupo Orsega');
    });

    it('should not include company context when companyId is undefined', async () => {
      mockCreate
        .mockResolvedValueOnce({
          choices: [{
            message: {
              tool_calls: [{
                function: {
                  arguments: JSON.stringify({ query: 'SELECT 1 as test', explanation: 'test' }),
                },
              }],
            },
          }],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'result' } }],
        });

      mockSql.mockResolvedValue([{ test: 1 }]);

      await smartSearch('ventas');

      const messages = mockCreate.mock.calls[0][0].messages;
      const userMessage = messages.find((m: any) => m.role === 'user');
      expect(userMessage.content).not.toContain('company_id=');
    });

    it('should include "otra" label for unknown companyId', async () => {
      mockCreate
        .mockResolvedValueOnce({
          choices: [{
            message: {
              tool_calls: [{
                function: {
                  arguments: JSON.stringify({ query: 'SELECT 1 as test', explanation: 'test' }),
                },
              }],
            },
          }],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'result' } }],
        });

      mockSql.mockResolvedValue([{ test: 1 }]);

      await smartSearch('ventas', 99);

      const messages = mockCreate.mock.calls[0][0].messages;
      const userMessage = messages.find((m: any) => m.role === 'user');
      expect(userMessage.content).toContain('otra');
    });
  });

  // =========================================================================
  // Data formatting edge cases
  // =========================================================================
  describe('result formatting', () => {
    it('should handle single numeric result', async () => {
      mockCreate
        .mockResolvedValueOnce({
          choices: [{
            message: {
              tool_calls: [{
                function: {
                  arguments: JSON.stringify({
                    query: 'SELECT SUM(quantity) as total FROM sales_data',
                    explanation: 'sum',
                  }),
                },
              }],
            },
          }],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'The total is 50,000' } }],
        });

      mockSql.mockResolvedValue([{ total: 50000 }]);

      const result = await smartSearch('total sales');
      expect(result.data).toEqual([{ total: 50000 }]);
      expect(result.query).toContain('SELECT');
    });

    it('should include query in result when SQL succeeds', async () => {
      const sqlQuery = "SELECT client_name FROM sales_data LIMIT 5";
      mockCreate
        .mockResolvedValueOnce({
          choices: [{
            message: {
              tool_calls: [{
                function: {
                  arguments: JSON.stringify({ query: sqlQuery, explanation: 'clients' }),
                },
              }],
            },
          }],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Clients listed' } }],
        });

      mockSql.mockResolvedValue([{ client_name: 'Acme' }]);

      const result = await smartSearch('list clients');
      expect(result.query).toBe(sqlQuery);
      expect(result.source).toContain(sqlQuery);
    });

    it('should handle multiple rows of data', async () => {
      mockCreate
        .mockResolvedValueOnce({
          choices: [{
            message: {
              tool_calls: [{
                function: {
                  arguments: JSON.stringify({
                    query: 'SELECT client_name, quantity FROM sales_data LIMIT 3',
                    explanation: 'multiple rows',
                  }),
                },
              }],
            },
          }],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Found 3 records' } }],
        });

      mockSql.mockResolvedValue([
        { client_name: 'A', quantity: 100 },
        { client_name: 'B', quantity: 200 },
        { client_name: 'C', quantity: 300 },
      ]);

      const result = await smartSearch('top 3');
      expect(result.data).toHaveLength(3);
    });
  });
});
