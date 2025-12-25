import { NextRequest, NextResponse } from 'next/server';
import {
  setMemory,
  getMemory,
  deleteMemory,
  queryMemories,
  listAllMemories,
} from '@/lib/memory-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { operation, deploymentId, userCookie, key, value, query } = body;

    if (!deploymentId || !userCookie) {
      return NextResponse.json(
        { error: 'Missing deploymentId or userCookie' },
        { status: 400 }
      );
    }

    let result;

    switch (operation) {
      case 'set':
        if (!key || !value) {
          return NextResponse.json(
            { error: 'Missing key or value for set operation' },
            { status: 400 }
          );
        }
        result = await setMemory(deploymentId, userCookie, key, value);
        break;

      case 'get':
        if (!key) {
          return NextResponse.json(
            { error: 'Missing key for get operation' },
            { status: 400 }
          );
        }
        const memory = await getMemory(deploymentId, userCookie, key);
        result = memory ? { found: true, memory } : { found: false };
        break;

      case 'delete':
        if (!key) {
          return NextResponse.json(
            { error: 'Missing key for delete operation' },
            { status: 400 }
          );
        }
        result = await deleteMemory(deploymentId, userCookie, key);
        break;

      case 'query':
        if (!query) {
          return NextResponse.json(
            { error: 'Missing query for query operation' },
            { status: 400 }
          );
        }
        const queryResult = await queryMemories(deploymentId, userCookie, query);
        result = {
          memories: queryResult.memories,
          pipeline: queryResult.pipeline,
          searchType: queryResult.searchType
        };
        break;

      case 'list':
        const allMemories = await listAllMemories(deploymentId, userCookie);
        result = { memories: allMemories };
        break;

      default:
        return NextResponse.json(
          { error: `Unknown operation: ${operation}` },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Memory API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const deploymentId = searchParams.get('deploymentId');
  const userCookie = searchParams.get('userCookie');

  if (!deploymentId || !userCookie) {
    return NextResponse.json(
      { error: 'Missing deploymentId or userCookie' },
      { status: 400 }
    );
  }

  try {
    const memories = await listAllMemories(deploymentId, userCookie);
    return NextResponse.json({ memories });
  } catch (error) {
    console.error('Memory list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
